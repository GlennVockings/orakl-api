import { BadRequestException } from '@nestjs/common';
import { LedgerType, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { FauxStakesLeaderboardService } from './faux-stakes-leaderboard.service';

describe('FauxStakesLeaderboardService', () => {
  const competitionFindUnique = jest.fn();
  const marketFindMany = jest.fn();
  const ledgerFindMany = jest.fn();
  const snapshotFindMany = jest.fn();
  const snapshotCreateMany = jest.fn();

  const prisma = {
    competition: {
      findUnique: competitionFindUnique,
    },

    market: {
      findMany: marketFindMany,
    },

    competitionLedgerTxn: {
      findMany: ledgerFindMany,
    },

    leaderboardSnapshot: {
      findMany: snapshotFindMany,
      createMany: snapshotCreateMany,
    },
  } as unknown as PrismaService;

  let service: FauxStakesLeaderboardService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new FauxStakesLeaderboardService(prisma);
  });

  it('rejects a competition that does not exist', async () => {
    competitionFindUnique.mockResolvedValue(null);

    await expect(
      service.getLeaderboardForCompetition('missing-competition'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(marketFindMany).not.toHaveBeenCalled();
    expect(ledgerFindMany).not.toHaveBeenCalled();
  });

  it('excludes unresolved market activity from the shared leaderboard', async () => {
    competitionFindUnique.mockResolvedValue({
      id: 'competition-1',

      members: [
        {
          userId: 'alice',
          user: {
            id: 'alice',
            displayName: 'Alice',
          },
        },
        {
          userId: 'bob',
          user: {
            id: 'bob',
            displayName: 'Bob',
          },
        },
      ],
    });

    marketFindMany.mockResolvedValue([
      {
        id: 'settled-market',
      },
    ]);

    ledgerFindMany.mockResolvedValue([
      /*
       * Starting balances have no marketId and are always visible in the
       * settled leaderboard.
       */
      {
        userId: 'alice',
        type: LedgerType.CREDIT,
        amount: new Prisma.Decimal(1000),
        marketId: null,
      },
      {
        userId: 'bob',
        type: LedgerType.CREDIT,
        amount: new Prisma.Decimal(1000),
        marketId: null,
      },

      /*
       * Alice lost 50 on a market that has resolved.
       * This is public leaderboard state.
       */
      {
        userId: 'alice',
        type: LedgerType.DEBIT,
        amount: new Prisma.Decimal(50),
        marketId: 'settled-market',
      },

      /*
       * Bob won a 100 payout from the same resolved market.
       */
      {
        userId: 'bob',
        type: LedgerType.PAYOUT,
        amount: new Prisma.Decimal(100),
        marketId: 'settled-market',
      },

      /*
       * Alice currently has 200 committed to an OPEN market.
       * Including this would reveal unresolved staking behaviour.
       */
      {
        userId: 'alice',
        type: LedgerType.DEBIT,
        amount: new Prisma.Decimal(200),
        marketId: 'open-market',
      },

      /*
       * Bob has 100 committed to a CLOSED but unresolved market.
       * This must remain private too.
       */
      {
        userId: 'bob',
        type: LedgerType.DEBIT,
        amount: new Prisma.Decimal(100),
        marketId: 'closed-unresolved-market',
      },
    ]);

    snapshotFindMany.mockResolvedValue([]);

    const result = await service.getLeaderboardForCompetition('competition-1');

    expect(marketFindMany).toHaveBeenCalledWith({
      where: {
        competitionId: 'competition-1',
        status: 'SETTLED',
      },
      select: {
        id: true,
      },
    });

    expect(result).toEqual({
      scoreLabel: 'Settled balance',

      rows: [
        {
          userId: 'bob',
          displayName: 'Bob',
          score: 1100,
          rank: 1,
          previousRank: null,
          rankDelta: null,
          details: {
            settledBalance: 1100,
          },
        },
        {
          userId: 'alice',
          displayName: 'Alice',
          score: 950,
          rank: 2,
          previousRank: null,
          rankDelta: null,
          details: {
            settledBalance: 950,
          },
        },
      ],
    });

    /*
     * Explicit privacy assertions.
     *
     * Alice's real live balance would be 750 after her unresolved stake.
     * Bob's live balance would be 1000 after his unresolved stake.
     *
     * Neither value may appear in the shared leaderboard.
     */
    expect(result.rows.find((row) => row.userId === 'alice')?.score).toBe(950);

    expect(result.rows.find((row) => row.userId === 'bob')?.score).toBe(1100);
  });

  it('uses the previous settled snapshot only for rank movement', async () => {
    competitionFindUnique.mockResolvedValue({
      id: 'competition-1',

      members: [
        {
          userId: 'alice',
          user: {
            id: 'alice',
            displayName: 'Alice',
          },
        },
        {
          userId: 'bob',
          user: {
            id: 'bob',
            displayName: 'Bob',
          },
        },
      ],
    });

    marketFindMany.mockResolvedValue([
      {
        id: 'settled-market-2',
      },
    ]);

    ledgerFindMany.mockResolvedValue([
      {
        userId: 'alice',
        type: LedgerType.CREDIT,
        amount: new Prisma.Decimal(1200),
        marketId: null,
      },
      {
        userId: 'bob',
        type: LedgerType.CREDIT,
        amount: new Prisma.Decimal(1000),
        marketId: null,
      },
    ]);

    snapshotFindMany
      .mockResolvedValueOnce([
        {
          marketId: 'settled-market-2',
          createdAt: new Date('2026-09-29T12:00:00.000Z'),
        },
        {
          marketId: 'settled-market-1',
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'alice',
          rank: 2,
        },
        {
          userId: 'bob',
          rank: 1,
        },
      ]);

    const result = await service.getLeaderboardForCompetition('competition-1');

    expect(result.rows).toEqual([
      {
        userId: 'alice',
        displayName: 'Alice',
        score: 1200,
        rank: 1,
        previousRank: 2,
        rankDelta: 1,
        details: {
          settledBalance: 1200,
        },
      },
      {
        userId: 'bob',
        displayName: 'Bob',
        score: 1000,
        rank: 2,
        previousRank: 1,
        rankDelta: -1,
        details: {
          settledBalance: 1000,
        },
      },
    ]);
  });

  it('creates retry-safe snapshots from settled balances', async () => {
    competitionFindUnique.mockResolvedValue({
      id: 'competition-1',

      members: [
        {
          userId: 'alice',
          user: {
            id: 'alice',
            displayName: 'Alice',
          },
        },
      ],
    });

    marketFindMany.mockResolvedValue([
      {
        id: 'market-1',
      },
    ]);

    ledgerFindMany.mockResolvedValue([
      {
        userId: 'alice',
        type: LedgerType.CREDIT,
        amount: new Prisma.Decimal(1000),
        marketId: null,
      },
      {
        userId: 'alice',
        type: LedgerType.DEBIT,
        amount: new Prisma.Decimal(100),
        marketId: 'market-1',
      },
    ]);

    snapshotCreateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.createSnapshot('competition-1', 'market-1');

    expect(snapshotCreateMany).toHaveBeenCalledWith({
      data: [
        {
          competitionId: 'competition-1',
          marketId: 'market-1',
          userId: 'alice',
          settledBalance: 900,
          rank: 1,
        },
      ],
      skipDuplicates: true,
    });

    expect(result).toEqual([
      {
        userId: 'alice',
        displayName: 'Alice',
        settledBalance: 900,
        rank: 1,
      },
    ]);
  });
});
