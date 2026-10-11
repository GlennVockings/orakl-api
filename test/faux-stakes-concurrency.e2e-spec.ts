import {
  BetStatus,
  GameType,
  LedgerType,
  MarketStatus,
  MemberRole,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

jest.mock('../src/games/faux-stakes/realtime/ws.gateway', () => ({
  WsGateway: class WsGateway {},
}));

import { BetsService } from '../src/games/faux-stakes/bets/bets.service';
import { MarketsService } from '../src/games/faux-stakes/markets/markets.service';
import { PrismaService } from '../src/prisma.service';
import { CompetitionsService } from '../src/platform/competitions/competitions.service';
import type { GameEngine } from '../src/platform/game-registry/game-engine.interface';
import type { GameEngineRegistryService } from '../src/platform/game-registry/game-engine-registry.service';

describe('Faux Stakes PostgreSQL concurrency', () => {
  const prisma = new PrismaService();

  let betsService: BetsService;

  const createdCompetitionIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    betsService = new BetsService(prisma);
  });

  afterEach(async () => {
    if (createdCompetitionIds.length > 0) {
      await prisma.competition.deleteMany({
        where: {
          id: {
            in: [...createdCompetitionIds],
          },
        },
      });

      createdCompetitionIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [...createdUserIds],
          },
        },
      });

      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(label: string) {
    const id = `e2e-user-${randomUUID()}`;

    const user = await prisma.user.create({
      data: {
        id,
        displayName: label,
        email: `${id}@example.test`,
        emailVerified: true,
      },
    });

    createdUserIds.push(user.id);

    return user;
  }

  async function createCompetition(hostUserId: string, startingChips = 1000) {
    const competition = await prisma.competition.create({
      data: {
        name: `E2E Competition ${randomUUID()}`,
        joinCode: randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase(),
        createdById: hostUserId,
        gameType: GameType.FAUX_STAKES,
        status: 'DRAFT',

        members: {
          create: {
            userId: hostUserId,
            role: MemberRole.HOST,
          },
        },

        fauxStakesCompetition: {
          create: {
            startingChips,
          },
        },

        ledgerTxns: {
          create: {
            userId: hostUserId,
            type: LedgerType.CREDIT,
            amount: new Prisma.Decimal(startingChips),
          },
        },
      },
    });

    createdCompetitionIds.push(competition.id);

    return competition;
  }

  async function addPlayer(
    competitionId: string,
    userId: string,
    startingChips = 1000,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.competitionMember.create({
        data: {
          competitionId,
          userId,
          role: MemberRole.PLAYER,
        },
      });

      await tx.competitionLedgerTxn.create({
        data: {
          competitionId,
          userId,
          type: LedgerType.CREDIT,
          amount: new Prisma.Decimal(startingChips),
        },
      });
    });
  }

  async function createOpenMarket(
    competitionId: string,
    name: string,
    odds = 2,
  ) {
    return prisma.market.create({
      data: {
        competitionId,
        name,
        status: MarketStatus.OPEN,

        selections: {
          create: [
            {
              label: 'Yes',
              decimalOdds: new Prisma.Decimal(odds),
              status: SelectionStatus.ACTIVE,
            },
            {
              label: 'No',
              decimalOdds: new Prisma.Decimal(odds),
              status: SelectionStatus.ACTIVE,
            },
          ],
        },
      },

      include: {
        selections: true,
      },
    });
  }

  async function getBalance(competitionId: string, userId: string) {
    const txns = await prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId,
        userId,
      },
      select: {
        type: true,
        amount: true,
      },
    });

    return txns.reduce((balance, txn) => {
      if (txn.type === LedgerType.DEBIT) {
        return balance.sub(txn.amount);
      }

      return balance.add(txn.amount);
    }, new Prisma.Decimal(0));
  }

  function createMarketsService() {
    const leaderboardService = {
      createSnapshot: jest.fn().mockResolvedValue(undefined),
    };

    const wsGateway = {
      emitMarketCreated: jest.fn(),
      emitMarketClosed: jest.fn(),
      emitMarketSettled: jest.fn(),
    };

    const service = new MarketsService(
      prisma,
      leaderboardService as never,
      wsGateway as never,
    );

    return {
      service,
      leaderboardService,
      wsGateway,
    };
  }

  it('serializes concurrent wallet spending across different markets', async () => {
    const host = await createUser('Concurrency Host');
    const player = await createUser('Concurrency Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const marketA = await createOpenMarket(
      competition.id,
      `Market A ${randomUUID()}`,
    );

    const marketB = await createOpenMarket(
      competition.id,
      `Market B ${randomUUID()}`,
    );

    const results = await Promise.allSettled([
      betsService.placeBet(player.id, competition.id, {
        marketId: marketA.id,
        selectionId: marketA.selections[0].id,
        stake: 600,
        idempotencyKey: randomUUID(),
      }),

      betsService.placeBet(player.id, competition.id, {
        marketId: marketB.id,
        selectionId: marketB.selections[0].id,
        stake: 600,
        idempotencyKey: randomUUID(),
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const bets = await prisma.bet.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
      },
    });

    expect(bets).toHaveLength(1);

    const debits = await prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
        type: LedgerType.DEBIT,
      },
    });

    expect(debits).toHaveLength(1);
    expect(debits[0].amount.equals(new Prisma.Decimal(600))).toBe(true);

    const balance = await getBalance(competition.id, player.id);

    expect(balance.equals(new Prisma.Decimal(400))).toBe(true);
  });

  it('turns 20 simultaneous copies of one idempotency key into one bet and one debit', async () => {
    const host = await createUser('Idempotency Host');
    const player = await createUser('Idempotency Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const market = await createOpenMarket(
      competition.id,
      `Idempotency Market ${randomUUID()}`,
    );

    const idempotencyKey = randomUUID();

    const requests = Array.from({ length: 20 }, () =>
      betsService.placeBet(player.id, competition.id, {
        marketId: market.id,
        selectionId: market.selections[0].id,
        stake: 25,
        idempotencyKey,
      }),
    );

    const results = await Promise.all(requests);

    expect(results).toHaveLength(20);

    const returnedBetIds = new Set(results.map((result) => result.bet.id));

    expect(returnedBetIds.size).toBe(1);

    const bets = await prisma.bet.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
        idempotencyKey,
      },
    });

    expect(bets).toHaveLength(1);

    const debits = await prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
        type: LedgerType.DEBIT,
        betId: bets[0].id,
      },
    });

    expect(debits).toHaveLength(1);
    expect(debits[0].amount.equals(new Prisma.Decimal(25))).toBe(true);

    const balance = await getBalance(competition.id, player.id);

    expect(balance.equals(new Prisma.Decimal(975))).toBe(true);
  });

  it('rejects a selection belonging to another market', async () => {
    const host = await createUser('Selection Host');
    const player = await createUser('Selection Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const marketA = await createOpenMarket(
      competition.id,
      `Selection Market A ${randomUUID()}`,
    );

    const marketB = await createOpenMarket(
      competition.id,
      `Selection Market B ${randomUUID()}`,
    );

    await expect(
      betsService.placeBet(player.id, competition.id, {
        marketId: marketA.id,
        selectionId: marketB.selections[0].id,
        stake: 10,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();

    const bets = await prisma.bet.count({
      where: {
        competitionId: competition.id,
        userId: player.id,
      },
    });

    expect(bets).toBe(0);

    const balance = await getBalance(competition.id, player.id);

    expect(balance.equals(new Prisma.Decimal(1000))).toBe(true);
  });

  it('rejects a market belonging to another competition', async () => {
    const hostA = await createUser('Competition A Host');
    const hostB = await createUser('Competition B Host');
    const player = await createUser('Cross Competition Player');

    const competitionA = await createCompetition(hostA.id);
    const competitionB = await createCompetition(hostB.id);

    await addPlayer(competitionA.id, player.id);
    await addPlayer(competitionB.id, player.id);

    const marketB = await createOpenMarket(
      competitionB.id,
      `Competition B Market ${randomUUID()}`,
    );

    await expect(
      betsService.placeBet(player.id, competitionA.id, {
        marketId: marketB.id,
        selectionId: marketB.selections[0].id,
        stake: 10,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();

    expect(
      await prisma.bet.count({
        where: {
          competitionId: competitionA.id,
          userId: player.id,
        },
      }),
    ).toBe(0);

    expect(
      (await getBalance(competitionA.id, player.id)).equals(
        new Prisma.Decimal(1000),
      ),
    ).toBe(true);
  });

  it('database uniqueness prevents duplicate case-insensitive team names', async () => {
    const host = await createUser('Team Host');

    const competition = await createCompetition(host.id);

    await prisma.team.create({
      data: {
        competitionId: competition.id,
        name: 'Oxted FC',
        normalizedName: 'oxted fc',
      },
    });

    await expect(
      prisma.team.create({
        data: {
          competitionId: competition.id,
          name: 'OXTED FC',
          normalizedName: 'oxted fc',
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(
      await prisma.team.count({
        where: {
          competitionId: competition.id,
        },
      }),
    ).toBe(1);
  });

  it('a failed stake never leaves a debit without a bet', async () => {
    const host = await createUser('Atomicity Host');
    const player = await createUser('Atomicity Player');

    const competition = await createCompetition(host.id, 100);

    await addPlayer(competition.id, player.id, 100);

    const market = await createOpenMarket(
      competition.id,
      `Atomicity Market ${randomUUID()}`,
    );

    await expect(
      betsService.placeBet(player.id, competition.id, {
        marketId: market.id,
        selectionId: market.selections[0].id,
        stake: 101,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();

    expect(
      await prisma.bet.count({
        where: {
          competitionId: competition.id,
          userId: player.id,
        },
      }),
    ).toBe(0);

    expect(
      await prisma.competitionLedgerTxn.count({
        where: {
          competitionId: competition.id,
          userId: player.id,
          type: LedgerType.DEBIT,
        },
      }),
    ).toBe(0);

    expect(
      (await getBalance(competition.id, player.id)).equals(
        new Prisma.Decimal(100),
      ),
    ).toBe(true);
  });

  it('keeps one pending bet for a normal successful stake', async () => {
    const host = await createUser('Control Host');
    const player = await createUser('Control Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const market = await createOpenMarket(
      competition.id,
      `Control Market ${randomUUID()}`,
    );

    const result = await betsService.placeBet(player.id, competition.id, {
      marketId: market.id,
      selectionId: market.selections[0].id,
      stake: 100,
      idempotencyKey: randomUUID(),
    });

    expect(result.bet.status).toBe(BetStatus.PENDING);

    expect(
      (await getBalance(competition.id, player.id)).equals(
        new Prisma.Decimal(900),
      ),
    ).toBe(true);
  });

  it('keeps stake and close mutually consistent when they race', async () => {
    const host = await createUser('Stake Close Host');
    const player = await createUser('Stake Close Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const market = await createOpenMarket(
      competition.id,
      `Stake Close ${randomUUID()}`,
    );

    const { service: marketsService } = createMarketsService();

    const results = await Promise.allSettled([
      betsService.placeBet(player.id, competition.id, {
        marketId: market.id,
        selectionId: market.selections[0].id,
        stake: 100,
        idempotencyKey: randomUUID(),
      }),

      marketsService.closeMarket(competition.id, market.id),
    ]);

    const finalMarket = await prisma.market.findUniqueOrThrow({
      where: {
        id: market.id,
      },
    });

    expect(finalMarket.status).toBe(MarketStatus.CLOSED);

    const bets = await prisma.bet.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
      },
    });

    const debits = await prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
        type: LedgerType.DEBIT,
      },
    });

    expect(bets.length).toBeLessThanOrEqual(1);
    expect(debits.length).toBe(bets.length);

    if (bets.length === 1) {
      expect(bets[0].status).toBe(BetStatus.PENDING);

      expect(
        (await getBalance(competition.id, player.id)).equals(
          new Prisma.Decimal(900),
        ),
      ).toBe(true);
    } else {
      expect(
        (await getBalance(competition.id, player.id)).equals(
          new Prisma.Decimal(1000),
        ),
      ).toBe(true);
    }

    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
  });

  it('keeps undo and close mutually consistent when they race', async () => {
    const host = await createUser('Undo Close Host');
    const player = await createUser('Undo Close Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const market = await createOpenMarket(
      competition.id,
      `Undo Close ${randomUUID()}`,
    );

    const placed = await betsService.placeBet(player.id, competition.id, {
      marketId: market.id,
      selectionId: market.selections[0].id,
      stake: 100,
      idempotencyKey: randomUUID(),
    });

    const { service: marketsService } = createMarketsService();

    await Promise.allSettled([
      betsService.undoBet(player.id, competition.id, placed.bet.id),
      marketsService.closeMarket(competition.id, market.id),
    ]);

    const finalMarket = await prisma.market.findUniqueOrThrow({
      where: {
        id: market.id,
      },
    });

    expect(finalMarket.status).toBe(MarketStatus.CLOSED);

    const bet = await prisma.bet.findUniqueOrThrow({
      where: {
        id: placed.bet.id,
      },
    });

    const refunds = await prisma.competitionLedgerTxn.findMany({
      where: {
        betId: placed.bet.id,
        type: LedgerType.REFUND,
      },
    });

    if (bet.status === BetStatus.VOID) {
      expect(refunds).toHaveLength(1);

      expect(
        (await getBalance(competition.id, player.id)).equals(
          new Prisma.Decimal(1000),
        ),
      ).toBe(true);
    } else {
      expect(bet.status).toBe(BetStatus.PENDING);
      expect(refunds).toHaveLength(0);

      expect(
        (await getBalance(competition.id, player.id)).equals(
          new Prisma.Decimal(900),
        ),
      ).toBe(true);
    }
  });

  it('allows only one of two simultaneous settlement attempts to settle and pay out', async () => {
    const host = await createUser('Settlement Host');
    const player = await createUser('Settlement Player');

    const competition = await createCompetition(host.id);

    await addPlayer(competition.id, player.id);

    const market = await createOpenMarket(
      competition.id,
      `Settlement Race ${randomUUID()}`,
      2,
    );

    const placed = await betsService.placeBet(player.id, competition.id, {
      marketId: market.id,
      selectionId: market.selections[0].id,
      stake: 100,
      idempotencyKey: randomUUID(),
    });

    const { service: marketsService } = createMarketsService();

    await marketsService.closeMarket(competition.id, market.id);

    const results = await Promise.allSettled([
      marketsService.settleMarket(competition.id, market.id, {
        winningSelectionId: market.selections[0].id,
      }),

      marketsService.settleMarket(competition.id, market.id, {
        winningSelectionId: market.selections[0].id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    const finalMarket = await prisma.market.findUniqueOrThrow({
      where: {
        id: market.id,
      },
    });

    expect(finalMarket.status).toBe(MarketStatus.SETTLED);

    const finalBet = await prisma.bet.findUniqueOrThrow({
      where: {
        id: placed.bet.id,
      },
    });

    expect(finalBet.status).toBe(BetStatus.WON);

    const payouts = await prisma.competitionLedgerTxn.findMany({
      where: {
        betId: placed.bet.id,
        type: LedgerType.PAYOUT,
      },
    });

    expect(payouts).toHaveLength(1);
    expect(payouts[0].amount.equals(new Prisma.Decimal(200))).toBe(true);

    expect(
      (await getBalance(competition.id, player.id)).equals(
        new Prisma.Decimal(1100),
      ),
    ).toBe(true);
  });

  it('gives one starting credit when the same new player joins 20 times concurrently', async () => {
    const host = await createUser('Join Host');
    const player = await createUser('Join Player');

    const competition = await createCompetition(host.id, 1000);

    const fauxStakesEngine: GameEngine = {
      gameType: GameType.FAUX_STAKES,

      isEnabled: () => true,

      getLeaderboard: () =>
        Promise.resolve({
          scoreLabel: 'Orakls',
          rows: [],
        }),

      onUserJoined: async ({ competitionId, userId, tx }) => {
        const config = await tx.fauxStakesCompetition.findUnique({
          where: {
            competitionId,
          },
          select: {
            startingChips: true,
          },
        });

        if (!config) {
          throw new Error('Missing Faux Stakes config');
        }

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
      },

      afterUserJoined: () => Promise.resolve(),
    };

    const registry = {
      get: jest.fn().mockReturnValue(fauxStakesEngine),
    } as unknown as GameEngineRegistryService;

    const competitionsService = new CompetitionsService(prisma, registry);

    const requests = Array.from({ length: 20 }, () =>
      competitionsService.joinCompetition(player.id, {
        joinCode: competition.joinCode,
      }),
    );

    const results = await Promise.all(requests);

    expect(results).toHaveLength(20);

    const memberships = await prisma.competitionMember.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
      },
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe(MemberRole.PLAYER);

    const startingCredits = await prisma.competitionLedgerTxn.findMany({
      where: {
        competitionId: competition.id,
        userId: player.id,
        type: LedgerType.CREDIT,
        betId: null,
        marketId: null,
      },
    });

    expect(startingCredits).toHaveLength(1);
    expect(startingCredits[0].amount.equals(new Prisma.Decimal(1000))).toBe(
      true,
    );

    expect(
      (await getBalance(competition.id, player.id)).equals(
        new Prisma.Decimal(1000),
      ),
    ).toBe(true);
  });
});
