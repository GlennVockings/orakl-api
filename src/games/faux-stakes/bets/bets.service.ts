import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  BetStatus,
  LedgerType,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { CreateBetDto } from './dto/create-bet.dto';

function txnSign(type: LedgerType) {
  return type === LedgerType.DEBIT ? -1 : 1;
}

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCurrentBalance(
    tx: Prisma.TransactionClient,
    competitionId: string,
    userId: string,
  ) {
    const txns = await tx.competitionLedgerTxn.findMany({
      where: { competitionId, userId },
      select: { type: true, amount: true },
    });

    return txns.reduce(
      (sum, txn) => sum + Number(txn.amount) * txnSign(txn.type),
      0,
    );
  }

  private async getExistingBetResult(
    idempotencyKey: string,
    userId: string,
    competitionId: string,
  ) {
    const bet = await this.prisma.bet.findUnique({
      where: { idempotencyKey },
    });

    if (!bet) return null;

    if (bet.userId !== userId || bet.competitionId !== competitionId) {
      throw new ForbiddenException('Idempotency key is already in use');
    }

    const txns = await this.prisma.competitionLedgerTxn.findMany({
      where: { competitionId, userId },
      select: { type: true, amount: true },
    });

    const currentBalance = txns.reduce(
      (sum, txn) => sum + Number(txn.amount) * txnSign(txn.type),
      0,
    );

    return { bet, currentBalance };
  }

  async placeBet(userId: string, competitionId: string, dto: CreateBetDto) {
    const existing = await this.getExistingBetResult(
      dto.idempotencyKey,
      userId,
      competitionId,
    );
    if (existing) return existing;

    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        // This conditional write serialises against the host closing the market.
        // If close wins the row lock first, this update affects zero rows.
        const openMarket = await tx.market.updateMany({
          where: {
            id: dto.marketId,
            competitionId,
            status: MarketStatus.OPEN,
          },
          data: { updatedAt: now },
        });

        if (openMarket.count !== 1) {
          const market = await tx.market.findFirst({
            where: { id: dto.marketId, competitionId },
            select: { id: true },
          });

          if (!market) {
            throw new BadRequestException(
              'Market does not exist for this competition',
            );
          }

          throw new ForbiddenException('Market is not open for betting');
        }

        const selection = await tx.selection.findFirst({
          where: {
            id: dto.selectionId,
            marketId: dto.marketId,
            status: SelectionStatus.ACTIVE,
          },
          select: {
            id: true,
            decimalOdds: true,
          },
        });

        if (!selection) {
          throw new BadRequestException(
            'Selection does not belong to this open market',
          );
        }

        const currentBalance = await this.getCurrentBalance(
          tx,
          competitionId,
          userId,
        );

        if (currentBalance < dto.stake) {
          throw new ForbiddenException('Insufficient balance');
        }

        const stake = new Prisma.Decimal(dto.stake);
        const oddsSnapshot = selection.decimalOdds;
        const potentialReturn = stake.mul(oddsSnapshot);

        const bet = await tx.bet.create({
          data: {
            competitionId,
            userId,
            selectionId: selection.id,
            stake,
            oddsSnapshot,
            potentialReturn,
            status: BetStatus.PENDING,
            placedAt: now,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        await tx.competitionLedgerTxn.create({
          data: {
            competitionId,
            userId,
            type: LedgerType.DEBIT,
            amount: stake,
            betId: bet.id,
            marketId: dto.marketId,
          },
        });

        await tx.competition.update({
          where: { id: competitionId },
          data: { lastActivityAt: now },
        });

        return {
          bet,
          currentBalance: currentBalance - dto.stake,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.getExistingBetResult(
          dto.idempotencyKey,
          userId,
          competitionId,
        );
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async getUserBets(userId: string, competitionId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { competitionId, userId },
      orderBy: { placedAt: 'desc' },
      include: {
        selection: {
          select: {
            id: true,
            label: true,
            status: true,
            team: { select: { id: true, name: true } },
            market: {
              select: {
                id: true,
                name: true,
                status: true,
                selections: {
                  select: {
                    id: true,
                    label: true,
                    status: true,
                    team: {
                      select: {
                        id: true,
                        name: true,
                        emoji: true,
                        color: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return bets.map((bet) => {
      const winningSelection =
        bet.selection.market.selections.find(
          (selection) => selection.status === SelectionStatus.WINNER,
        ) ?? null;

      return {
        id: bet.id,
        stake: Number(bet.stake),
        potentialReturn: Number(bet.potentialReturn),
        oddsSnapshot: Number(bet.oddsSnapshot),
        placedAt: bet.placedAt,
        settledAt: bet.settledAt,
        status: bet.status,
        isSettled: !!bet.settledAt,
        market: {
          id: bet.selection.market.id,
          name: bet.selection.market.name,
          status: bet.selection.market.status,
        },
        selection: {
          id: bet.selection.id,
          label: bet.selection.label,
          team: bet.selection.team,
          status: bet.selection.status,
        },
        winningSelection: winningSelection
          ? {
              id: winningSelection.id,
              label: winningSelection.label,
              team: winningSelection.team,
              status: winningSelection.status,
            }
          : null,
      };
    });
  }

  async getGameBets(competitionId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { competitionId },
      orderBy: { placedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true } },
        selection: {
          select: {
            id: true,
            label: true,
            status: true,
            team: { select: { id: true, name: true } },
            market: {
              select: {
                id: true,
                name: true,
                status: true,
                selections: {
                  select: {
                    id: true,
                    label: true,
                    status: true,
                    team: {
                      select: {
                        id: true,
                        name: true,
                        emoji: true,
                        color: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return bets.map((bet) => {
      const winningSelection =
        bet.selection.market.selections.find(
          (selection) => selection.status === SelectionStatus.WINNER,
        ) ?? null;

      return {
        id: bet.id,
        stake: Number(bet.stake),
        potentialReturn: Number(bet.potentialReturn),
        oddsSnapshot: Number(bet.oddsSnapshot),
        placedAt: bet.placedAt,
        settledAt: bet.settledAt,
        status: bet.status,
        isSettled: !!bet.settledAt,
        market: {
          id: bet.selection.market.id,
          name: bet.selection.market.name,
          status: bet.selection.market.status,
        },
        selection: {
          id: bet.selection.id,
          label: bet.selection.label,
          team: bet.selection.team,
          status: bet.selection.status,
        },
        winningSelection: winningSelection
          ? {
              id: winningSelection.id,
              label: winningSelection.label,
              team: winningSelection.team,
              status: winningSelection.status,
            }
          : null,
        user: { ...bet.user },
      };
    });
  }

  async undoBet(userId: string, competitionId: string, betId: string) {
    const now = new Date();

    const bet = await this.prisma.bet.findFirst({
      where: { competitionId, id: betId, userId },
      include: {
        selection: {
          include: {
            market: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!bet) throw new BadRequestException('Bet does not exist');
    if (bet.status !== BetStatus.PENDING) {
      throw new BadRequestException('Bet is not pending');
    }
    if (bet.selection.market.status !== MarketStatus.OPEN) {
      throw new BadRequestException(
        'Market has been closed or settled, unable to undo',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { id: betId },
        data: { status: BetStatus.VOID, settledAt: now },
      });
      await tx.competitionLedgerTxn.create({
        data: {
          competitionId,
          userId: bet.userId,
          type: LedgerType.REFUND,
          amount: bet.stake,
          betId: bet.id,
          marketId: bet.selection.marketId,
        },
      });
    });

    return { ok: true, betId };
  }
}
