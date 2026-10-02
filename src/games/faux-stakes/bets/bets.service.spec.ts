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

describe('BetsService', () => {
  const fixedNow = new Date('2026-07-23T12:00:00.000Z');

  const betFindUnique = jest.fn();
  const betFindMany = jest.fn();

  const transactionBetCreate = jest.fn();
  const transactionBetFindFirst = jest.fn();
  const transactionBetUpdateMany = jest.fn();

  const ledgerFindMany = jest.fn();
  const ledgerCreate = jest.fn();

  const marketUpdateMany = jest.fn();
  const selectionFindFirst = jest.fn();
  const competitionUpdate = jest.fn();
  const queryRaw = jest.fn();

  const transactionClient = {
    $queryRaw: queryRaw,
    market: {
      updateMany: marketUpdateMany,
    },
    selection: {
      findFirst: selectionFindFirst,
    },
    competitionLedgerTxn: {
      findMany: ledgerFindMany,
      create: ledgerCreate,
    },
    bet: {
      create: transactionBetCreate,
      findFirst: transactionBetFindFirst,
      updateMany: transactionBetUpdateMany,
    },
    competition: {
      update: competitionUpdate,
    },
  };

  const transaction = jest.fn();

  const prisma = {
    bet: {
      findUnique: betFindUnique,
      findMany: betFindMany,
    },
    competitionLedgerTxn: {
      findMany: ledgerFindMany,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  let service: BetsService;

  const dto = {
    marketId: 'market-1',
    selectionId: 'selection-1',
    stake: 10,
    idempotencyKey: '3d594650-3436-4a73-92eb-c5cbdadf13c5',
  };

  const selection = {
    id: 'selection-1',
    decimalOdds: new Prisma.Decimal(2.5),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();

    betFindUnique.mockResolvedValue(null);

    transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    marketUpdateMany.mockResolvedValue({
      count: 1,
    });

    queryRaw.mockResolvedValue([
      {
        id: 'membership-1',
      },
    ]);

    selectionFindFirst.mockResolvedValue(selection);

    competitionUpdate.mockResolvedValue({
      id: 'competition-1',
    });

    service = new BetsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('placeBet', () => {
    it('returns an existing bet for the same idempotency key without creating another stake', async () => {
      const existingBet = {
        id: 'bet-existing',
        competitionId: 'competition-1',
        userId: 'user-1',
        selectionId: 'selection-1',
        stake: new Prisma.Decimal(10),
        oddsSnapshot: new Prisma.Decimal(2.5),
        potentialReturn: new Prisma.Decimal(25),
        status: BetStatus.PENDING,
        placedAt: fixedNow,
        settledAt: null,
        idempotencyKey: dto.idempotencyKey,
      };

      betFindUnique.mockResolvedValue(existingBet);

      ledgerFindMany.mockResolvedValue([
        {
          type: LedgerType.CREDIT,
          amount: new Prisma.Decimal(100),
        },
        {
          type: LedgerType.DEBIT,
          amount: new Prisma.Decimal(10),
        },
      ]);

      const result = await service.placeBet('user-1', 'competition-1', dto);

      expect(result).toEqual({
        bet: existingBet,
        currentBalance: 90,
      });

      expect(transaction).not.toHaveBeenCalled();
      expect(transactionBetCreate).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
    });

    it('rejects reuse of an idempotency key owned by another player', async () => {
      betFindUnique.mockResolvedValue({
        id: 'bet-existing',
        competitionId: 'competition-1',
        userId: 'another-user',
        idempotencyKey: dto.idempotencyKey,
      });

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects reuse of an idempotency key from another competition', async () => {
      betFindUnique.mockResolvedValue({
        id: 'bet-existing',
        competitionId: 'competition-2',
        userId: 'user-1',
        idempotencyKey: dto.idempotencyKey,
      });

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects a market that is not open for staking', async () => {
      marketUpdateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toThrow('Market is not open for staking');

      expect(marketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
          competitionId: 'competition-1',
          status: MarketStatus.OPEN,
        },
        data: {
          updatedAt: fixedNow,
        },
      });

      expect(queryRaw).not.toHaveBeenCalled();
      expect(transactionBetCreate).not.toHaveBeenCalled();
    });

    it('rejects a player who is not a competition member', async () => {
      queryRaw.mockResolvedValue([]);

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toThrow('You are not a member of this competition');

      expect(selectionFindFirst).not.toHaveBeenCalled();
      expect(transactionBetCreate).not.toHaveBeenCalled();
    });

    it('rejects a selection outside the requested open market', async () => {
      selectionFindFirst.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'competition-1', {
          ...dto,
          selectionId: 'selection-from-another-market',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(selectionFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'selection-from-another-market',
          marketId: 'market-1',
          status: SelectionStatus.ACTIVE,
          market: {
            competitionId: 'competition-1',
            status: MarketStatus.OPEN,
          },
        },
        select: {
          id: true,
          decimalOdds: true,
        },
      });

      expect(transactionBetCreate).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
    });

    it('rejects a stake when the available balance is too low', async () => {
      ledgerFindMany.mockResolvedValue([
        {
          type: LedgerType.CREDIT,
          amount: new Prisma.Decimal(5),
        },
      ]);

      await expect(
        service.placeBet('user-1', 'competition-1', dto),
      ).rejects.toThrow('Insufficient balance');

      expect(transactionBetCreate).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
      expect(competitionUpdate).not.toHaveBeenCalled();
    });

    it('calculates the wallet using Decimal values and creates the bet and debit atomically', async () => {
      ledgerFindMany.mockResolvedValue([
        {
          type: LedgerType.CREDIT,
          amount: new Prisma.Decimal(100),
        },
        {
          type: LedgerType.DEBIT,
          amount: new Prisma.Decimal(15),
        },
        {
          type: LedgerType.REFUND,
          amount: new Prisma.Decimal(5),
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
        settledAt: null,
        idempotencyKey: dto.idempotencyKey,
      };

      transactionBetCreate.mockResolvedValue(createdBet);

      ledgerCreate.mockResolvedValue({
        id: 'ledger-1',
      });

      const result = await service.placeBet('user-1', 'competition-1', dto);

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(transactionBetCreate).toHaveBeenCalledWith({
        data: {
          competitionId: 'competition-1',
          userId: 'user-1',
          selectionId: 'selection-1',
          stake: new Prisma.Decimal(10),
          oddsSnapshot: new Prisma.Decimal(2.5),
          potentialReturn: new Prisma.Decimal(25),
          status: BetStatus.PENDING,
          placedAt: fixedNow,
          idempotencyKey: dto.idempotencyKey,
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

      expect(result).toEqual({
        bet: createdBet,
        currentBalance: 80,
      });
    });
  });
});
