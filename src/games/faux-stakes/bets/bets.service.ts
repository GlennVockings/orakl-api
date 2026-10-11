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

function signedAmount(
  type: LedgerType,
  amount: Prisma.Decimal,
): Prisma.Decimal {
  return type === LedgerType.DEBIT ? amount.negated() : amount;
}

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCurrentBalance(
    tx: Prisma.TransactionClient,
    competitionId: string,
    userId: string,
  ): Promise<Prisma.Decimal> {
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
      (sum, txn) => sum.add(signedAmount(txn.type, txn.amount)),
      new Prisma.Decimal(0),
    );
  }

  private async lockPlayerWallet(
    tx: Prisma.TransactionClient,
    competitionId: string,
    userId: string,
  ): Promise<void> {
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
      (sum, txn) => sum.add(signedAmount(txn.type, txn.amount)),
      new Prisma.Decimal(0),
    );

    return {
      bet,
      currentBalance: currentBalance.toNumber(),
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
         * Lock the market row while proving it is OPEN.
         *
         * closeMarket() updates this same row, so staking and closing
         * cannot cross one another without one transaction waiting.
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
          throw new BadRequestException('Market is not open for staking');
        }

        /*
         * One CompetitionMember row represents this player's wallet
         * inside this competition.
         *
         * Locking it serializes concurrent balance-changing stakes for
         * the same player even when they target different markets.
         */
        await this.lockPlayerWallet(tx, competitionId, userId);

        const selection = await tx.selection.findFirst({
          where: {
            id: dto.selectionId,
            marketId: dto.marketId,
            status: SelectionStatus.ACTIVE,
            market: {
              competitionId,
              status: MarketStatus.OPEN,
            },
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

        const stake = new Prisma.Decimal(dto.stake);

        if (currentBalance.lt(stake)) {
          throw new BadRequestException('Insufficient balance');
        }

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
         * Bet + DEBIT are atomic.
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
          currentBalance: currentBalance.sub(stake).toNumber(),
        };
      });
    } catch (error) {
      /*
       * The unique idempotencyKey is the final protection against two
       * simultaneous copies of the same stake.
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
        stake: bet.stake.toNumber(),
        potentialReturn: bet.potentialReturn.toNumber(),
        oddsSnapshot: bet.oddsSnapshot.toNumber(),
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
        stake: bet.stake.toNumber(),
        potentialReturn: bet.potentialReturn.toNumber(),
        oddsSnapshot: bet.oddsSnapshot.toNumber(),
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
       * Lock the market while proving it is still OPEN.
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
