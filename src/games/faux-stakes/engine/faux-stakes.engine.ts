import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerType, Prisma } from '@prisma/client';
import {
  CompetitionContext,
  CompetitionCreatedContext,
  CompetitionUserContext,
  CompetitionUserTransactionContext,
  GameCompetitionSummary,
  GameEngine,
  GamePlayerState,
  LeaderboardResult,
} from '../../../platform/game-registry/game-engine.interface';
import { GameType } from '../../../platform/game-registry/game-type';
import { FauxStakesLeaderboardService } from '../leaderboard/faux-stakes-leaderboard.service';
import { WsGateway } from '../realtime/ws.gateway';
import { PrismaService } from '../../../prisma.service';
import { FauxStakesConfigService } from '../config/faux-stakes-config.service';

const DEFAULT_STARTING_CHIPS = 1000;
const MIN_STARTING_CHIPS = 1;
const MAX_STARTING_CHIPS = 1_000_000;
const MAX_INITIAL_TEAMS = 100;
const MAX_TEAM_NAME_LENGTH = 50;

type FauxStakesCompetitionConfig = {
  startingChips: number;
  teamNames: string[];
};

function parseFauxStakesConfig(config: unknown): FauxStakesCompetitionConfig {
  if (config === undefined || config === null) {
    return {
      startingChips: DEFAULT_STARTING_CHIPS,
      teamNames: [],
    };
  }

  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new BadRequestException('Faux Stakes config must be an object');
  }

  const value = config as Record<string, unknown>;

  const allowedKeys = new Set(['startingChips', 'teamNames']);

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unknown Faux Stakes config field: ${unknownKeys[0]}`,
    );
  }

  const startingChips =
    value.startingChips === undefined
      ? DEFAULT_STARTING_CHIPS
      : value.startingChips;

  if (
    typeof startingChips !== 'number' ||
    !Number.isInteger(startingChips) ||
    startingChips < MIN_STARTING_CHIPS ||
    startingChips > MAX_STARTING_CHIPS
  ) {
    throw new BadRequestException(
      `startingChips must be an integer between ${MIN_STARTING_CHIPS} and ${MAX_STARTING_CHIPS}`,
    );
  }

  const rawTeamNames = value.teamNames === undefined ? [] : value.teamNames;

  if (!Array.isArray(rawTeamNames)) {
    throw new BadRequestException('teamNames must be an array');
  }

  if (rawTeamNames.length > MAX_INITIAL_TEAMS) {
    throw new BadRequestException(
      `A competition can start with at most ${MAX_INITIAL_TEAMS} teams`,
    );
  }

  if (rawTeamNames.some((name) => typeof name !== 'string')) {
    throw new BadRequestException('Every team name must be a string');
  }

  const cleanedTeamNames = (rawTeamNames as string[]).map((name) =>
    name.trim(),
  );

  if (
    cleanedTeamNames.some(
      (name) => name.length === 0 || name.length > MAX_TEAM_NAME_LENGTH,
    )
  ) {
    throw new BadRequestException(
      `Team names must be between 1 and ${MAX_TEAM_NAME_LENGTH} characters`,
    );
  }

  const uniqueNames = new Map<string, string>();

  for (const name of cleanedTeamNames) {
    const normalized = name.toLowerCase();

    if (uniqueNames.has(normalized)) {
      throw new BadRequestException(`Duplicate team name: ${name}`);
    }

    uniqueNames.set(normalized, name);
  }

  return {
    startingChips,
    teamNames: [...uniqueNames.values()],
  };
}

function signedAmount(type: LedgerType, amount: Prisma.Decimal) {
  return type === LedgerType.DEBIT ? amount.negated() : amount;
}

@Injectable()
export class FauxStakesEngine implements GameEngine {
  gameType: GameType = 'FAUX_STAKES';

  constructor(
    private readonly leaderboardService: FauxStakesLeaderboardService,
    private readonly wsGateway: WsGateway,
    private readonly prisma: PrismaService,
    private readonly configService: FauxStakesConfigService,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  validateCompetitionConfig(config: unknown): void {
    parseFauxStakesConfig(config);
  }

  getLeaderboard({
    competitionId,
  }: CompetitionContext): Promise<LeaderboardResult> {
    return this.leaderboardService.getLeaderboardForCompetition(competitionId);
  }

  async getPlayerState({
    userId,
    competitionId,
  }: CompetitionUserContext): Promise<GamePlayerState> {
    const txns = await this.prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId,
        userId,
      },
      select: {
        type: true,
        amount: true,
        marketId: true,
      },
    });

    const currentBalance = txns.reduce(
      (sum, txn) => sum.add(signedAmount(txn.type, txn.amount)),
      new Prisma.Decimal(0),
    );

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

    const settledBalance = txns.reduce((sum, txn) => {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);

      if (!shouldInclude) {
        return sum;
      }

      return sum.add(signedAmount(txn.type, txn.amount));
    }, new Prisma.Decimal(0));

    return {
      currentBalance: currentBalance.toNumber(),
      settledBalance: settledBalance.toNumber(),
    };
  }

  async getCompetitionSummary({
    userId,
    competitionId,
  }: CompetitionUserContext): Promise<GameCompetitionSummary> {
    const config = await this.configService.getCompetition(competitionId);

    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      select: {
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
      return {
        summary: {},
        membership: {},
      };
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

    const settledBalanceByUser = new Map<string, Prisma.Decimal>();

    for (const member of competition.members) {
      settledBalanceByUser.set(member.userId, new Prisma.Decimal(0));
    }

    for (const txn of txns) {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);

      if (!shouldInclude) {
        continue;
      }

      const current =
        settledBalanceByUser.get(txn.userId) ?? new Prisma.Decimal(0);

      settledBalanceByUser.set(
        txn.userId,
        current.add(signedAmount(txn.type, txn.amount)),
      );
    }

    const leaderboard = competition.members
      .map((member) => ({
        userId: member.userId,
        displayName: member.user.displayName,
        balance: (
          settledBalanceByUser.get(member.userId) ?? new Prisma.Decimal(0)
        ).toNumber(),
      }))
      .sort((a, b) => b.balance - a.balance);

    const playerState = await this.getPlayerState({
      userId,
      competitionId,
    });

    return {
      summary: {
        startingChips: config.startingChips,
        leaderboard,
      },
      membership: {
        balance: playerState.currentBalance,
      },
    };
  }

  async onCompetitionCreated({
    competitionId,
    hostUserId,
    config,
    tx,
  }: CompetitionCreatedContext): Promise<void> {
    const parsed = parseFauxStakesConfig(config);

    await tx.fauxStakesCompetition.create({
      data: {
        competitionId,
        startingChips: parsed.startingChips,
      },
    });

    if (parsed.teamNames.length > 0) {
      await tx.team.createMany({
        data: parsed.teamNames.map((name) => ({
          competitionId,
          name,
        })),
      });
    }

    await tx.competitionLedgerTxn.create({
      data: {
        competitionId,
        userId: hostUserId,
        type: LedgerType.CREDIT,
        amount: parsed.startingChips,
      },
    });
  }

  async onUserJoined({
    userId,
    competitionId,
    tx,
  }: CompetitionUserTransactionContext): Promise<void> {
    const config = await tx.fauxStakesCompetition.findUnique({
      where: {
        competitionId,
      },
      select: {
        startingChips: true,
      },
    });

    if (!config) {
      throw new BadRequestException(
        'Faux Stakes competition config does not exist',
      );
    }

    /*
     * The CompetitionMember upsert happens before this hook in the
     * SAME transaction.
     *
     * PostgreSQL therefore serialises concurrent first-time joins on
     * the unique competitionId/userId membership row. Once a second
     * join reaches this point, the first transaction has committed and
     * its starting credit is visible.
     */
    const existingCredit = await tx.competitionLedgerTxn.findFirst({
      where: {
        competitionId,
        userId,
        type: LedgerType.CREDIT,
        betId: null,
        marketId: null,
      },
      select: {
        id: true,
      },
    });

    if (!existingCredit) {
      await tx.competitionLedgerTxn.create({
        data: {
          competitionId,
          userId,
          type: LedgerType.CREDIT,
          amount: config.startingChips,
        },
      });
    }
  }

  async afterUserJoined({
    userId,
    competitionId,
  }: CompetitionUserContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        displayName: true,
      },
    });

    if (!user) {
      return;
    }

    this.wsGateway.emitMemberJoined(competitionId, {
      userId: user.id,
      displayName: user.displayName,
    });
  }
}
