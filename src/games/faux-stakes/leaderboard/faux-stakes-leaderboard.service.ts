import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

function signedAmount(type: LedgerType, amount: Prisma.Decimal) {
  return type === LedgerType.DEBIT ? amount.negated() : amount;
}

@Injectable()
export class FauxStakesLeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettledBalances(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!competition) {
      throw new BadRequestException('Competition does not exist');
    }

    const settledMarkets = await this.prisma.market.findMany({
      where: {
        competitionId,
        status: 'SETTLED',
      },
      select: {
        id: true,
      },
    });

    const settledMarketIds = new Set(settledMarkets.map((market) => market.id));

    const txns = await this.prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId,
      },
      select: {
        userId: true,
        type: true,
        amount: true,
        marketId: true,
      },
    });

    const balanceByUser = new Map<string, Prisma.Decimal>();

    for (const member of competition.members) {
      balanceByUser.set(member.userId, new Prisma.Decimal(0));
    }

    for (const txn of txns) {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);

      if (!shouldInclude) {
        continue;
      }

      const current = balanceByUser.get(txn.userId) ?? new Prisma.Decimal(0);

      balanceByUser.set(
        txn.userId,
        current.add(signedAmount(txn.type, txn.amount)),
      );
    }

    return competition.members
      .map((member) => ({
        userId: member.user.id,
        displayName: member.user.displayName,
        settledBalance: (
          balanceByUser.get(member.user.id) ?? new Prisma.Decimal(0)
        ).toNumber(),
      }))
      .sort((a, b) => b.settledBalance - a.settledBalance)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }));
  }

  async createSnapshot(competitionId: string, marketId: string) {
    const rows = await this.getSettledBalances(competitionId);

    /*
     * marketId/userId is unique in Prisma.
     *
     * skipDuplicates makes this operation safely retryable if settlement
     * committed but the request failed during a later side effect.
     */
    await this.prisma.leaderboardSnapshot.createMany({
      data: rows.map((row) => ({
        competitionId,
        marketId,
        userId: row.userId,
        settledBalance: row.settledBalance,
        rank: row.rank,
      })),
      skipDuplicates: true,
    });

    return rows;
  }

  async getLeaderboardForCompetition(competitionId: string) {
    const settledRows = await this.getSettledBalances(competitionId);

    const latestSnapshotMarkets =
      await this.prisma.leaderboardSnapshot.findMany({
        where: {
          competitionId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          marketId: true,
          createdAt: true,
        },
        distinct: ['marketId'],
        take: 2,
      });

    const previousMarketId = latestSnapshotMarkets[1]?.marketId;

    let previousRanks = new Map<string, number>();

    if (previousMarketId) {
      const previousSnapshotRows =
        await this.prisma.leaderboardSnapshot.findMany({
          where: {
            competitionId,
            marketId: previousMarketId,
          },
          select: {
            userId: true,
            rank: true,
          },
        });

      previousRanks = new Map(
        previousSnapshotRows.map((row) => [row.userId, row.rank]),
      );
    }

    return {
      scoreLabel: 'Settled balance',

      /*
       * Deliberately no current/live balance here.
       *
       * This endpoint is visible to every competition member. Returning
       * live balances would reveal how many Orakls other players have
       * committed to unresolved markets.
       *
       * A player's own private available balance comes from /me.
       */
      rows: settledRows.map((row) => {
        const previousRank = previousRanks.get(row.userId) ?? null;

        return {
          userId: row.userId,
          displayName: row.displayName,
          score: row.settledBalance,
          rank: row.rank,
          previousRank,
          rankDelta: previousRank !== null ? previousRank - row.rank : null,
          details: {
            settledBalance: row.settledBalance,
          },
        };
      }),
    };
  }
}
