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
      where: {
        competitionId,
        userId,
      },
      select: {
        type: true,
        amount: true,
      },
    });

    return txns.reduce(
      (sum, txn) => sum + Number(txn.amount) * txnSign(txn.type),
      0,
    );
  }

  private async lockPlayerWallet(
    tx: Prisma.TransactionClient,
    competitionId: string,
    userId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "CompetitionMember"
      WHERE "competitionId" = ${competitionId}
        AND "userId" = ${userId}
      FOR UPDATE
    `);

    if (rows.length !== 1) {
      throw new ForbiddenException('You are not a member of this competition');
    }
  }

  private async getExistingBetResult(
    idempotencyKey: string,
    userId: string,
    competitionId: string,
  ) {
    const bet = await this.prisma.bet.findUnique({
      where: {
        idempotencyKey,
      },
    });

    if (!bet) {
      return null;
    }

    if (bet.userId !== userId || bet.competitionId !== competitionId) {
      throw new ForbiddenException('Idempotency key is already in use');
    }

    const txns = await this.prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId,
        userId,
      },
      select: {
        type: true,
        amount: true,
      },
    });

    const currentBalance = txns.reduce(
      (sum, txn) => sum + Number(txn.amount) * txnSign(txn.type),
      0,
    );

    return {
      bet,
      currentBalance,
    };
  }

  async placeBet(userId: string, competitionId: string, dto: CreateBetDto) {
    const existing = await this.getExistingBetResult(
      dto.idempotencyKey,
      userId,
      competitionId,
    );

    if (existing) {
      return existing;
    }

    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * This conditional write does two jobs:
         *
         * 1. It proves the market is still OPEN at the point the stake
         *    starts being accepted.
         * 2. PostgreSQL takes a row lock on the market, serialising this
         *    operation against closeMarket().
         *
         * If closing wins the row lock first, this affects zero rows.
         */
        const openMarket = await tx.market.updateMany({
          where: {
            id: dto.marketId,
            competitionId,
            status: MarketStatus.OPEN,
          },
          data: {
            updatedAt: now,
          },
        });

        if (openMarket.count !== 1) {
          const market = await tx.market.findFirst({
            where: {
              id: dto.marketId,
              competitionId,
            },
            select: {
              id: true,
            },
          });

          if (!market) {
            throw new BadRequestException(
              'Market does not exist for this competition',
            );
          }

          throw new ForbiddenException('Market is not open for betting');
        }

        /*
         * Market locking protects the market lifecycle, but it does not
         * protect a player's balance across DIFFERENT markets.
         *
         * The CompetitionMember row is unique for competition + user, so
         * we use it as the per-player wallet lock.
         *
         * Two simultaneous stakes from the same player must therefore
         * calculate their balances one after the other.
         */
        await this.lockPlayerWallet(tx, competitionId, userId);

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

        /*
         * The stake and its debit live in the same transaction.
         *
         * We therefore cannot end up with:
         * - a Bet without its DEBIT, or
         * - a DEBIT without its Bet.
         */
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
          where: {
            id: competitionId,
          },
          data: {
            lastActivityAt: now,
          },
        });

        return {
          bet,
          currentBalance: currentBalance - dto.stake,
        };
      });
    } catch (error) {
      /*
       * A double-submit can arrive twice before either request has seen
       * the other's Bet.
       *
       * The database unique constraint on idempotencyKey is the final
       * authority. P2002 means another request won that race, so return
       * the already-created result instead of charging twice.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.getExistingBetResult(
          dto.idempotencyKey,
          userId,
          competitionId,
        );

        if (duplicate) {
          return duplicate;
        }
      }

      throw error;
    }
  }

  async getUserBets(userId: string, competitionId: string) {
    const bets = await this.prisma.bet.findMany({
      where: {
        competitionId,
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

  async getGameBets(competitionId: string) {
    const bets = await this.prisma.bet.findMany({
      where: {
        competitionId,
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

  async undoBet(userId: string, competitionId: string, betId: string) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      /*
       * Find enough information to identify the market first.
       *
       * We deliberately do not trust this first read as our final OPEN
       * check. Its purpose is only to locate the market row we need to
       * lock.
       */
      const candidateBet = await tx.bet.findFirst({
        where: {
          competitionId,
          id: betId,
          userId,
        },
        select: {
          id: true,
          selection: {
            select: {
              marketId: true,
            },
          },
        },
      });

      if (!candidateBet) {
        throw new BadRequestException('Bet does not exist');
      }

      /*
       * Use the same market-row locking strategy as placeBet().
       *
       * If closeMarket() wins first, the market is CLOSED and this update
       * affects zero rows.
       *
       * If undo wins first, closeMarket() waits until the refund commits.
       */
      const openMarket = await tx.market.updateMany({
        where: {
          id: candidateBet.selection.marketId,
          competitionId,
          status: MarketStatus.OPEN,
        },
        data: {
          updatedAt: now,
        },
      });

      if (openMarket.count !== 1) {
        throw new BadRequestException(
          'Market has been closed or settled, unable to undo',
        );
      }

      /*
       * Re-read the Bet after obtaining the market lock.
       *
       * This means our decision is based on state protected by the same
       * transaction that performs the refund.
       */
      const bet = await tx.bet.findFirst({
        where: {
          id: betId,
          competitionId,
          userId,
          status: BetStatus.PENDING,
        },
        include: {
          selection: {
            select: {
              marketId: true,
            },
          },
        },
      });

      if (!bet) {
        throw new BadRequestException('Bet is not pending');
      }

      const updated = await tx.bet.updateMany({
        where: {
          id: bet.id,
          status: BetStatus.PENDING,
        },
        data: {
          status: BetStatus.VOID,
          settledAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Bet is no longer pending');
      }

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

      await tx.competition.update({
        where: {
          id: competitionId,
        },
        data: {
          lastActivityAt: now,
        },
      });

      return {
        ok: true,
        betId,
      };
    });
  }
}
