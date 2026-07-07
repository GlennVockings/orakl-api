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
import { PrismaService } from 'src/prisma.service';
import { CreateBetDto } from './dto/create-bet.dto';

function txnSign(type: LedgerType) {
  switch (type) {
    case 'DEBIT':
      return -1;
    case 'CREDIT':
    case 'PAYOUT':
    case 'REFUND':
    default:
      return 1;
  }
}

@Injectable()
export class BetsService {
  constructor(private prisma: PrismaService) {}

  private async getCurrentBalance(
    tx: Prisma.TransactionClient,
    gameId: string,
    userId: string,
  ) {
    const txns = await tx.gameLedgerTxn.findMany({
      where: {
        gameId,
        userId,
      },
      select: {
        type: true,
        amount: true,
      },
    });

    return txns.reduce((sum, txn) => {
      const signedAmount = Number(txn.amount) * txnSign(txn.type);
      return sum + signedAmount;
    }, 0);
  }

  async placeBet(userId: string, gameId: string, dto: CreateBetDto) {
    const now = new Date();

    const market = await this.prisma.market.findFirst({
      where: {
        id: dto.marketId,
        gameId,
      },
      include: {
        selections: true,
      },
    });

    if (!market) {
      throw new BadRequestException('Market does not exist for this game');
    }

    if (market.status !== 'OPEN') {
      throw new ForbiddenException('Market is not open for betting');
    }

    const selection = market.selections.find((s) => s.id === dto.selectionId);

    if (!selection) {
      throw new BadRequestException('Selection does not belong to this market');
    }

    if (selection.status !== 'ACTIVE') {
      throw new ForbiddenException('Selection is not active');
    }

    const stake = new Prisma.Decimal(dto.stake);
    const oddsSnapshot = selection.decimalOdds;
    const potentialReturn = new Prisma.Decimal(dto.stake).mul(
      selection.decimalOdds,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.getCurrentBalance(tx, gameId, userId);

      if (currentBalance < dto.stake) {
        throw new ForbiddenException('Insufficient balance');
      }

      const bet = await tx.bet.create({
        data: {
          gameId,
          userId,
          selectionId: dto.selectionId,
          stake,
          oddsSnapshot,
          potentialReturn,
          status: BetStatus.PENDING,
          placedAt: now,
        },
      });

      await tx.gameLedgerTxn.create({
        data: {
          gameId,
          userId,
          type: LedgerType.DEBIT,
          amount: stake,
          betId: bet.id,
          marketId: dto.marketId,
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: { lastActivityAt: now },
      });

      const updatedBalance = await this.getCurrentBalance(tx, gameId, userId);

      return {
        bet,
        currentBalance: updatedBalance,
      };
    });

    return result;
  }

  async getUserBets(userId: string, gameId: string) {
    const bets = await this.prisma.bet.findMany({
      where: {
        gameId,
        userId,
      },
      orderBy: {
        placedAt: 'desc',
      },
      include: {
        selection: {
          select: {
            id: true,
            label: true,
            status: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
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

  async getGameBets(gameId: string) {
    const bets = await this.prisma.bet.findMany({
      where: {
        gameId,
      },
      orderBy: {
        placedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
        selection: {
          select: {
            id: true,
            label: true,
            status: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
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

        user: {
          ...bet.user,
        },
      };
    });
  }

  async undoBet(userId: string, gameId: string, betId: string) {
    const now = new Date();

    const bet = await this.prisma.bet.findFirst({
      where: {
        gameId,
        id: betId,
        userId,
      },
      include: {
        selection: {
          include: {
            market: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!bet) {
      throw new BadRequestException('Bet does not exist');
    }

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
        where: {
          id: betId,
        },
        data: {
          status: BetStatus.VOID,
          settledAt: now,
        },
      });

      await tx.gameLedgerTxn.create({
        data: {
          gameId,
          userId: bet.userId,
          type: LedgerType.REFUND,
          amount: bet.stake,
          betId: bet.id,
          marketId: bet.selection.marketId,
        },
      });
    });

    return {
      ok: true,
      betId,
    };
  }
}
