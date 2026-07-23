import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BetStatus,
  LedgerType,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { BetsService } from './bets.service';

type LedgerFindManyArgs = {
  where: {
    competitionId: string;
    userId: string;
  };
  select: {
    type: true;
    amount: true;
  };
};

type BetCreateArgs = {
  data: {
    competitionId: string;
    userId: string;
    selectionId: string;
    stake: Prisma.Decimal;
    oddsSnapshot: Prisma.Decimal;
    potentialReturn: Prisma.Decimal;
    status: BetStatus;
    placedAt: Date;
  };
};

type LedgerCreateArgs = {
  data: {
    competitionId: string;
    userId: string;
    type: LedgerType;
    amount: Prisma.Decimal;
    betId: string;
    marketId: string;
  };
};

type CompetitionUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    lastActivityAt: Date;
  };
};

describe('BetsService', () => {
  const fixedNow = new Date('2026-07-23T12:00:00.000Z');

  const marketFindFirst = jest.fn();

  const ledgerFindMany = jest.fn<
    Promise<
      Array<{
        type: LedgerType;
        amount: Prisma.Decimal;
      }>
    >,
    [LedgerFindManyArgs]
  >();

  const betCreate = jest.fn<
    Promise<{
      id: string;
      competitionId: string;
      userId: string;
      selectionId: string;
      stake: Prisma.Decimal;
      oddsSnapshot: Prisma.Decimal;
      potentialReturn: Prisma.Decimal;
      status: BetStatus;
      placedAt: Date;
    }>,
    [BetCreateArgs]
  >();

  const ledgerCreate = jest.fn<
    Promise<{
      id: string;
    }>,
    [LedgerCreateArgs]
  >();

  const competitionUpdate = jest.fn<
    Promise<{
      id: string;
    }>,
    [CompetitionUpdateArgs]
  >();

  const transactionClient = {
    competitionLedgerTxn: {
      findMany: ledgerFindMany,
      create: ledgerCreate,
    },
    bet: {
      create: betCreate,
    },
    competition: {
      update: competitionUpdate,
    },
  };

  type TransactionCallback = (tx: typeof transactionClient) => Promise<unknown>;

  const transaction = jest.fn<Promise<unknown>, [TransactionCallback]>();

  const prisma = {
    market: {
      findFirst: marketFindFirst,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  let service: BetsService;

  const dto = {
    marketId: 'market-1',
    selectionId: 'selection-1',
    stake: 10,
  };

  const openMarket = {
    id: 'market-1',
    competitionId: 'competition-1',
    status: MarketStatus.OPEN,
    selections: [
      {
        id: 'selection-1',
        status: SelectionStatus.ACTIVE,
        decimalOdds: new Prisma.Decimal(2.5),
      },
    ],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();

    transaction.mockImplementation(async (callback) =>
      callback(transactionClient),
    );

    service = new BetsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('placeBet', () => {
    it('rejects a market outside the competition', async () => {
      marketFindFirst.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(marketFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
          competitionId: 'competition-1',
        },
        include: {
          selections: true,
        },
      });

      expect(transaction).not.toHaveBeenCalled();
      expect(betCreate).not.toHaveBeenCalled();
    });

    it('rejects a market that is not open', async () => {
      marketFindFirst.mockResolvedValue({
        ...openMarket,
        status: MarketStatus.CLOSED,
      });

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
      expect(betCreate).not.toHaveBeenCalled();
    });

    it('rejects a selection outside the market', async () => {
      marketFindFirst.mockResolvedValue(openMarket);

      await expect(
        service.placeBet('user-1', 'competition-1', {
          ...dto,
          selectionId: 'selection-from-another-market',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(betCreate).not.toHaveBeenCalled();
    });

    it('rejects an inactive selection', async () => {
      marketFindFirst.mockResolvedValue({
        ...openMarket,
        selections: [
          {
            ...openMarket.selections[0],
            status: SelectionStatus.LOSER,
          },
        ],
      });

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
      expect(betCreate).not.toHaveBeenCalled();
    });

    it('rejects a bet when the balance is too low', async () => {
      marketFindFirst.mockResolvedValue(openMarket);

      ledgerFindMany.mockResolvedValue([
        {
          type: LedgerType.CREDIT,
          amount: new Prisma.Decimal(5),
        },
      ]);

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toThrow('Insufficient balance');

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(ledgerFindMany).toHaveBeenCalledWith({
        where: {
          competitionId: 'competition-1',
          userId: 'user-1',
        },
        select: {
          type: true,
          amount: true,
        },
      });

      expect(betCreate).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
      expect(competitionUpdate).not.toHaveBeenCalled();
    });

    it('creates the bet and matching ledger debit', async () => {
      marketFindFirst.mockResolvedValue(openMarket);

      ledgerFindMany
        .mockResolvedValueOnce([
          {
            type: LedgerType.CREDIT,
            amount: new Prisma.Decimal(100),
          },
        ])
        .mockResolvedValueOnce([
          {
            type: LedgerType.CREDIT,
            amount: new Prisma.Decimal(100),
          },
          {
            type: LedgerType.DEBIT,
            amount: new Prisma.Decimal(10),
          },
        ]);

      const createdBet = {
        id: 'bet-1',
        competitionId: 'competition-1',
        userId: 'user-1',
        selectionId: 'selection-1',
        stake: new Prisma.Decimal(10),
        oddsSnapshot: new Prisma.Decimal(2.5),
        potentialReturn: new Prisma.Decimal(25),
        status: BetStatus.PENDING,
        placedAt: fixedNow,
      };

      betCreate.mockResolvedValue(createdBet);

      ledgerCreate.mockResolvedValue({
        id: 'ledger-1',
      });

      competitionUpdate.mockResolvedValue({
        id: 'competition-1',
      });

      const result = await service.placeBet('user-1', 'competition-1', dto);

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(betCreate).toHaveBeenCalledWith({
        data: {
          competitionId: 'competition-1',
          userId: 'user-1',
          selectionId: 'selection-1',
          stake: new Prisma.Decimal(10),
          oddsSnapshot: new Prisma.Decimal(2.5),
          potentialReturn: new Prisma.Decimal(25),
          status: BetStatus.PENDING,
          placedAt: fixedNow,
        },
      });

      expect(ledgerCreate).toHaveBeenCalledWith({
        data: {
          competitionId: 'competition-1',
          userId: 'user-1',
          type: LedgerType.DEBIT,
          amount: new Prisma.Decimal(10),
          betId: 'bet-1',
          marketId: 'market-1',
        },
      });

      expect(competitionUpdate).toHaveBeenCalledWith({
        where: {
          id: 'competition-1',
        },
        data: {
          lastActivityAt: fixedNow,
        },
      });

      expect(ledgerFindMany).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        bet: createdBet,
        currentBalance: 90,
      });
    });
  });
});
