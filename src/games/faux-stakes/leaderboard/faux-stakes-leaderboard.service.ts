import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { LedgerType } from '@prisma/client';

function txnSign(type: LedgerType) {
  // CREDIT/PAYOUT/REFUND add, DEBIT subtract
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
export class FauxStakesLeaderboardService {
  constructor(private prisma: PrismaService) {}

  private async getSettledBalances(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
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

    if (!game) {
      throw new BadRequestException('Game does not exist');
    }

    const settledMarkets = await this.prisma.market.findMany({
      where: {
        gameId,
        status: 'SETTLED',
      },
      select: {
        id: true,
      },
    });

    const settledMarketIds = new Set(settledMarkets.map((m) => m.id));

    const txns = await this.prisma.gameLedgerTxn.findMany({
      where: {
        gameId,
      },
      select: {
        userId: true,
        type: true,
        amount: true,
        marketId: true,
      },
    });

    const balanceByUser = new Map<string, number>();

    for (const member of game.members) {
      balanceByUser.set(member.userId, 0);
    }

    for (const txn of txns) {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);

      if (!shouldInclude) continue;

      const signedAmount = Number(txn.amount) * txnSign(txn.type);
      balanceByUser.set(
        txn.userId,
        (balanceByUser.get(txn.userId) ?? 0) + signedAmount,
      );
    }

    const rows = game.members
      .map((member) => ({
        userId: member.user.id,
        displayName: member.user.displayName,
        settledBalance: balanceByUser.get(member.user.id) ?? 0,
      }))
      .sort((a, b) => b.settledBalance - a.settledBalance)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }));

    return rows;
  }

  async createSnapshot(gameId: string, marketId: string) {
    const rows = await this.getSettledBalances(gameId);

    await this.prisma.leaderboardSnapshot.createMany({
      data: rows.map((row) => ({
        gameId,
        marketId,
        userId: row.userId,
        settledBalance: row.settledBalance,
        rank: row.rank,
      })),
    });

    return rows;
  }

  async getLeaderboardForCompetition(gameId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
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

    if (!game) {
      throw new BadRequestException('Competition does not exist');
    }

    // Current balance = all txns
    const currentTxns = await this.prisma.gameLedgerTxn.findMany({
      where: { gameId },
      select: {
        userId: true,
        type: true,
        amount: true,
      },
    });

    const currentBalanceByUser = new Map<string, number>();

    for (const member of game.members) {
      currentBalanceByUser.set(member.userId, 0);
    }

    for (const txn of currentTxns) {
      const signedAmount = Number(txn.amount) * txnSign(txn.type);
      currentBalanceByUser.set(
        txn.userId,
        (currentBalanceByUser.get(txn.userId) ?? 0) + signedAmount,
      );
    }

    // Current settled ranking
    const settledRows = await this.getSettledBalances(gameId);

    // Get latest two settled markets with snapshots
    const latestSnapshotMarkets =
      await this.prisma.leaderboardSnapshot.findMany({
        where: { gameId },
        orderBy: { createdAt: 'desc' },
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
            gameId,
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
      rows: settledRows.map((row) => {
        const previousRank = previousRanks.get(row.userId) ?? null;
        const currentBalance = currentBalanceByUser.get(row.userId) ?? 0;

        return {
          userId: row.userId,
          displayName: row.displayName,
          score: row.settledBalance,
          rank: row.rank,
          previousRank,
          rankDelta: previousRank !== null ? previousRank - row.rank : null,
          details: {
            currentBalance,
            settledBalance: row.settledBalance,
          },
        };
      }),
    };
  }
}
