import { Injectable } from '@nestjs/common';
import {
  CompetitionCreatedContext,
  GameCompetitionSummary,
  GameEngine,
  GamePlayerState,
  GameType,
  LeaderboardRow,
} from '../../../platform/game-registry/game-engine.interface';
import { FauxStakesLeaderboardService } from '../leaderboard/faux-stakes-leaderboard.service';
import { WsGateway } from '../realtime/ws.gateway';
import { PrismaService } from '../../../prisma.service';

type FauxStakesCompetitionConfig = {
  startingChips?: number;
  teamNames?: string[];
};

function getFauxStakesConfig(config: unknown): FauxStakesCompetitionConfig {
  if (!config || typeof config !== 'object') return {};
  return config;
}

@Injectable()
export class FauxStakesEngine implements GameEngine {
  gameType: GameType = 'FAUX_STAKES';

  constructor(
    private readonly leaderboardService: FauxStakesLeaderboardService,
    private readonly wsGateway: WsGateway,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  getLeaderboard(competitionId: string): Promise<LeaderboardRow[]> {
    return this.leaderboardService.getLeaderboardForCompetition(competitionId);
  }

  async getPlayerState(
    userId: string,
    competitionId: string,
  ): Promise<GamePlayerState> {
    const txns = await this.prisma.gameLedgerTxn.findMany({
      where: {
        gameId: competitionId,
        userId,
      },
      select: {
        type: true,
        amount: true,
        marketId: true,
      },
    });

    const currentBalance = txns.reduce((sum, txn) => {
      const sign = txn.type === 'DEBIT' ? -1 : 1;
      return sum + Number(txn.amount) * sign;
    }, 0);

    const settledMarkets = await this.prisma.market.findMany({
      where: {
        gameId: competitionId,
        status: 'SETTLED',
      },
      select: {
        id: true,
      },
    });

    const settledMarketIds = new Set(settledMarkets.map((market) => market.id));

    const settledBalance = txns.reduce((sum, txn) => {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);
      if (!shouldInclude) return sum;

      const sign = txn.type === 'DEBIT' ? -1 : 1;
      return sum + Number(txn.amount) * sign;
    }, 0);

    return {
      currentBalance,
      settledBalance,
    };
  }

  async getCompetitionSummary(
    userId: string,
    competitionId: string,
  ): Promise<GameCompetitionSummary> {
    const game = await this.prisma.game.findUnique({
      where: { id: competitionId },
      select: {
        startingChips: true,
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

    if (!game) return {};

    const txns = await this.prisma.gameLedgerTxn.findMany({
      where: { gameId: competitionId },
      select: {
        userId: true,
        type: true,
        amount: true,
      },
    });

    const balanceByUser = new Map<string, number>();

    for (const member of game.members) {
      balanceByUser.set(member.userId, game.startingChips);
    }

    for (const txn of txns) {
      const sign = txn.type === 'DEBIT' ? -1 : 1;
      balanceByUser.set(
        txn.userId,
        (balanceByUser.get(txn.userId) ?? game.startingChips) +
          Number(txn.amount) * sign,
      );
    }

    const leaderboard = game.members
      .map((member) => ({
        userId: member.userId,
        displayName: member.user.displayName,
        balance: balanceByUser.get(member.userId) ?? game.startingChips,
      }))
      .sort((a, b) => b.balance - a.balance);

    return {
      startingChips: game.startingChips,
      myMembership: {
        balance: balanceByUser.get(userId) ?? game.startingChips,
      },
      leaderboard,
    };
  }

  async onCompetitionCreated({
    competitionId,
    hostUserId,
    config,
  }: CompetitionCreatedContext): Promise<void> {
    const { startingChips = 1000, teamNames = [] } =
      getFauxStakesConfig(config);

    const cleanedTeamNames = teamNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const uniqueTeamNames = Array.from(
      new Map(
        cleanedTeamNames.map((name) => [name.toLowerCase(), name]),
      ).values(),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.fauxStakesCompetition.upsert({
        where: { gameId: competitionId },
        update: {
          startingChips,
        },
        create: {
          gameId: competitionId,
          startingChips,
        },
      });

      if (uniqueTeamNames.length > 0) {
        await tx.team.createMany({
          data: uniqueTeamNames.map((name) => ({
            gameId: competitionId,
            name,
          })),
          skipDuplicates: true,
        });
      }

      const existingCredit = await tx.gameLedgerTxn.findFirst({
        where: {
          gameId: competitionId,
          userId: hostUserId,
        },
        select: { id: true },
      });

      if (!existingCredit) {
        await tx.gameLedgerTxn.create({
          data: {
            gameId: competitionId,
            userId: hostUserId,
            type: 'CREDIT',
            amount: startingChips,
          },
        });
      }
    });
  }

  async onUserJoined(userId: string, competitionId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { id: competitionId },
      select: { startingChips: true },
    });

    if (!game) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    if (!user) return;

    await this.prisma.$transaction(async (tx) => {
      const hasAnyTxn = await tx.gameLedgerTxn.findFirst({
        where: { gameId: competitionId, userId },
        select: { id: true },
      });

      if (!hasAnyTxn) {
        await tx.gameLedgerTxn.create({
          data: {
            gameId: competitionId,
            userId,
            type: 'CREDIT',
            amount: game.startingChips,
          },
        });
      }
    });

    this.wsGateway.emitMemberJoined(competitionId, {
      userId: user.id,
      displayName: user.displayName,
    });
  }
}
