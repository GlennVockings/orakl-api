jest.mock('../realtime/ws.gateway', () => ({
  WsGateway: class WsGateway {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BetStatus,
  LedgerType,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { FauxStakesLeaderboardService } from '../leaderboard/faux-stakes-leaderboard.service';
import { WsGateway } from '../realtime/ws.gateway';
import { MarketsService } from './markets.service';

describe('MarketsService', () => {
  const fixedNow = new Date('2026-07-23T12:00:00.000Z');

  const marketFindFirst = jest.fn();

  const marketUpdateMany = jest.fn();
  const competitionUpdate = jest.fn();
  const selectionFindMany = jest.fn();
  const selectionUpdateMany = jest.fn();
  const selectionUpdate = jest.fn();
  const betFindMany = jest.fn();
  const betUpdateMany = jest.fn();
  const ledgerCreate = jest.fn();

  const createSnapshot = jest.fn();

  const emitMarketClosed = jest.fn();
  const emitMarketSettled = jest.fn();

  const transactionClient = {
    market: {
      updateMany: marketUpdateMany,
    },
    competition: {
      update: competitionUpdate,
    },
    selection: {
      findMany: selectionFindMany,
      updateMany: selectionUpdateMany,
      update: selectionUpdate,
    },
    bet: {
      findMany: betFindMany,
      updateMany: betUpdateMany,
    },
    competitionLedgerTxn: {
      create: ledgerCreate,
    },
  };

  const transaction = jest.fn();

  const prisma = {
    market: {
      findFirst: marketFindFirst,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  const leaderboardService = {
    createSnapshot,
  } as unknown as FauxStakesLeaderboardService;

  const wsGateway = {
    emitMarketClosed,
    emitMarketSettled,
  } as unknown as WsGateway;

  let service: MarketsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();

    transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    competitionUpdate.mockResolvedValue({
      id: 'competition-1',
    });

    service = new MarketsService(prisma, leaderboardService, wsGateway);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('closeMarket', () => {
    it('rejects a market outside the competition', async () => {
      marketFindFirst.mockResolvedValue(null);

      await expect(
        service.closeMarket('competition-1', 'market-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(marketUpdateMany).not.toHaveBeenCalled();
      expect(emitMarketClosed).not.toHaveBeenCalled();
    });

    it('rejects a market that is no longer open', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
      });

      marketUpdateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.closeMarket('competition-1', 'market-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(marketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
          competitionId: 'competition-1',
          status: MarketStatus.OPEN,
        },
        data: {
          status: MarketStatus.CLOSED,
        },
      });

      expect(competitionUpdate).not.toHaveBeenCalled();
      expect(emitMarketClosed).not.toHaveBeenCalled();
    });

    it('closes an open market and emits the realtime event after commit', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
      });

      marketUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.closeMarket('competition-1', 'market-1');

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(marketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
          competitionId: 'competition-1',
          status: MarketStatus.OPEN,
        },
        data: {
          status: MarketStatus.CLOSED,
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

      expect(emitMarketClosed).toHaveBeenCalledWith('competition-1', {
        id: 'market-1',
        name: 'Premier League winner',
      });

      expect(result).toEqual({
        ok: true,
        marketId: 'market-1',
        status: MarketStatus.CLOSED,
      });
    });
  });

  describe('settleMarket', () => {
    const winningSelectionId = 'selection-1';
    const losingSelectionId = 'selection-2';

    const market = {
      id: 'market-1',
      name: 'Premier League winner',
    };

    const winningBet = {
      id: 'bet-1',
      competitionId: 'competition-1',
      userId: 'user-1',
      selectionId: winningSelectionId,
      stake: new Prisma.Decimal(10),
      oddsSnapshot: new Prisma.Decimal(2.5),
      potentialReturn: new Prisma.Decimal(25),
      status: BetStatus.PENDING,
      placedAt: fixedNow,
      settledAt: null,
    };

    const losingBet = {
      id: 'bet-2',
      competitionId: 'competition-1',
      userId: 'user-2',
      selectionId: losingSelectionId,
      stake: new Prisma.Decimal(10),
      oddsSnapshot: new Prisma.Decimal(3),
      potentialReturn: new Prisma.Decimal(30),
      status: BetStatus.PENDING,
      placedAt: fixedNow,
      settledAt: null,
    };

    function prepareSuccessfulSettlement() {
      marketFindFirst.mockResolvedValue(market);

      marketUpdateMany.mockResolvedValue({
        count: 1,
      });

      selectionFindMany.mockResolvedValue([
        {
          id: winningSelectionId,
        },
        {
          id: losingSelectionId,
        },
      ]);

      betFindMany.mockResolvedValue([winningBet, losingBet]);

      betUpdateMany.mockResolvedValue({
        count: 1,
      });

      ledgerCreate.mockResolvedValue({
        id: 'ledger-1',
      });

      selectionUpdateMany.mockResolvedValue({
        count: 2,
      });

      selectionUpdate.mockResolvedValue({
        id: winningSelectionId,
      });

      createSnapshot.mockResolvedValue(undefined);
    }

    it('settles bets, pays winners and finalises the market atomically', async () => {
      prepareSuccessfulSettlement();

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
      });

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(marketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
          competitionId: 'competition-1',
          status: MarketStatus.CLOSED,
        },
        data: {
          status: MarketStatus.SETTLED,
        },
      });

      expect(selectionFindMany).toHaveBeenCalledWith({
        where: {
          marketId: 'market-1',
        },
        select: {
          id: true,
        },
      });

      expect(betFindMany).toHaveBeenCalledWith({
        where: {
          competitionId: 'competition-1',
          selectionId: {
            in: [winningSelectionId, losingSelectionId],
          },
          status: BetStatus.PENDING,
        },
      });

      expect(betUpdateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'bet-1',
          status: BetStatus.PENDING,
        },
        data: {
          status: BetStatus.WON,
          settledAt: fixedNow,
        },
      });

      expect(betUpdateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: 'bet-2',
          status: BetStatus.PENDING,
        },
        data: {
          status: BetStatus.LOST,
          settledAt: fixedNow,
        },
      });

      expect(ledgerCreate).toHaveBeenCalledTimes(1);

      expect(ledgerCreate).toHaveBeenCalledWith({
        data: {
          competitionId: 'competition-1',
          userId: 'user-1',
          type: LedgerType.PAYOUT,
          amount: winningBet.potentialReturn,
          betId: 'bet-1',
          marketId: 'market-1',
        },
      });

      expect(selectionUpdateMany).toHaveBeenCalledWith({
        where: {
          marketId: 'market-1',
        },
        data: {
          status: SelectionStatus.LOSER,
        },
      });

      expect(selectionUpdate).toHaveBeenCalledWith({
        where: {
          id: winningSelectionId,
        },
        data: {
          status: SelectionStatus.WINNER,
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

      expect(createSnapshot).toHaveBeenCalledWith('competition-1', 'market-1');

      expect(emitMarketSettled).toHaveBeenCalledWith('competition-1', {
        id: 'market-1',
        name: 'Premier League winner',
        winningSelectionId,
      });

      expect(result).toEqual({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.SETTLED,
        winningSelectionId,
      });
    });

    it('rejects a second settlement attempt before processing bets', async () => {
      marketFindFirst.mockResolvedValue(market);

      marketUpdateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId,
        }),
      ).rejects.toThrow('Only closed markets can be resolved');

      expect(selectionFindMany).not.toHaveBeenCalled();
      expect(betFindMany).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
      expect(createSnapshot).not.toHaveBeenCalled();
      expect(emitMarketSettled).not.toHaveBeenCalled();
    });

    it('rejects a winning selection that does not belong to the market', async () => {
      marketFindFirst.mockResolvedValue(market);

      marketUpdateMany.mockResolvedValue({
        count: 1,
      });

      selectionFindMany.mockResolvedValue([
        {
          id: winningSelectionId,
        },
        {
          id: losingSelectionId,
        },
      ]);

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId: 'selection-from-another-market',
        }),
      ).rejects.toThrow('Winning selection does not belong to this market');

      expect(betFindMany).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();
      expect(createSnapshot).not.toHaveBeenCalled();
    });

    it('resolves a closed market even when no stakes were placed', async () => {
      marketFindFirst.mockResolvedValue(market);

      marketUpdateMany.mockResolvedValue({
        count: 1,
      });

      selectionFindMany.mockResolvedValue([
        {
          id: winningSelectionId,
        },
        {
          id: losingSelectionId,
        },
      ]);

      betFindMany.mockResolvedValue([]);

      selectionUpdateMany.mockResolvedValue({
        count: 2,
      });

      selectionUpdate.mockResolvedValue({
        id: winningSelectionId,
      });

      createSnapshot.mockResolvedValue(undefined);

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
      });

      expect(betUpdateMany).not.toHaveBeenCalled();
      expect(ledgerCreate).not.toHaveBeenCalled();

      expect(selectionUpdateMany).toHaveBeenCalledWith({
        where: {
          marketId: 'market-1',
        },
        data: {
          status: SelectionStatus.LOSER,
        },
      });

      expect(selectionUpdate).toHaveBeenCalledWith({
        where: {
          id: winningSelectionId,
        },
        data: {
          status: SelectionStatus.WINNER,
        },
      });

      expect(createSnapshot).toHaveBeenCalledWith('competition-1', 'market-1');

      expect(emitMarketSettled).toHaveBeenCalledWith('competition-1', {
        id: 'market-1',
        name: 'Premier League winner',
        winningSelectionId,
      });

      expect(result).toEqual({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.SETTLED,
        winningSelectionId,
      });
    });

    it('fails the authoritative settlement if a pending bet changes during settlement', async () => {
      prepareSuccessfulSettlement();

      betUpdateMany
        .mockResolvedValueOnce({
          count: 0,
        })
        .mockResolvedValue({
          count: 1,
        });

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId,
        }),
      ).rejects.toThrow('A stake changed while this market was being resolved');

      expect(ledgerCreate).not.toHaveBeenCalled();
      expect(createSnapshot).not.toHaveBeenCalled();
      expect(emitMarketSettled).not.toHaveBeenCalled();
    });

    it('still returns successful settlement when leaderboard snapshot creation fails after commit', async () => {
      prepareSuccessfulSettlement();

      createSnapshot.mockRejectedValue(
        new Error('Snapshot service unavailable'),
      );

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
      });

      expect(result).toEqual({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.SETTLED,
        winningSelectionId,
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(ledgerCreate).toHaveBeenCalledTimes(1);

      expect(createSnapshot).toHaveBeenCalledWith('competition-1', 'market-1');

      expect(emitMarketSettled).toHaveBeenCalledWith('competition-1', {
        id: 'market-1',
        name: 'Premier League winner',
        winningSelectionId,
      });
    });

    it('still returns successful settlement when realtime delivery fails after commit', async () => {
      prepareSuccessfulSettlement();

      emitMarketSettled.mockImplementation(() => {
        throw new Error('Socket server unavailable');
      });

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
      });

      expect(result).toEqual({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.SETTLED,
        winningSelectionId,
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(ledgerCreate).toHaveBeenCalledTimes(1);

      expect(createSnapshot).toHaveBeenCalledWith('competition-1', 'market-1');

      expect(emitMarketSettled).toHaveBeenCalledTimes(1);
    });

    it('survives both derived effects failing after financial settlement has committed', async () => {
      prepareSuccessfulSettlement();

      createSnapshot.mockRejectedValue(
        new Error('Snapshot service unavailable'),
      );

      emitMarketSettled.mockImplementation(() => {
        throw new Error('Socket server unavailable');
      });

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
      });

      expect(result.status).toBe(MarketStatus.SETTLED);

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(betUpdateMany).toHaveBeenCalledTimes(2);

      expect(ledgerCreate).toHaveBeenCalledTimes(1);

      expect(ledgerCreate).toHaveBeenCalledWith({
        data: {
          competitionId: 'competition-1',
          userId: 'user-1',
          type: LedgerType.PAYOUT,
          amount: winningBet.potentialReturn,
          betId: 'bet-1',
          marketId: 'market-1',
        },
      });
    });
  });
});
