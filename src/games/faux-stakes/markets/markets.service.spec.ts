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

type CompetitionUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    lastActivityAt: Date;
  };
};

describe('MarketsService', () => {
  const fixedNow = new Date('2026-07-23T12:00:00.000Z');
  const marketFindFirst = jest.fn();
  const marketUpdate = jest.fn();
  const competitionUpdate = jest.fn<
    Promise<{ id: string }>,
    [CompetitionUpdateArgs]
  >();
  const betFindMany = jest.fn();
  const selectionUpdate = jest.fn();
  const ledgerCreate = jest.fn();
  const betUpdate = jest.fn();
  const createSnapshot = jest.fn();

  const transactionClient = {
    market: {
      update: marketUpdate,
    },
    competition: {
      update: competitionUpdate,
    },
    bet: {
      findMany: betFindMany,
      update: betUpdate,
    },
    selection: {
      update: selectionUpdate,
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
    bet: {
      findMany: betFindMany,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  const leaderboardService = {
    createSnapshot,
  } as unknown as FauxStakesLeaderboardService;

  const emitMarketClosed = jest.fn();
  const emitMarketSettled = jest.fn();

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

    service = new MarketsService(prisma, leaderboardService, wsGateway);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('closeMarket', () => {
    it('throws when the market does not belong to the competition', async () => {
      marketFindFirst.mockResolvedValue(null);

      await expect(
        service.closeMarket('competition-1', 'market-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(marketUpdate).not.toHaveBeenCalled();
      expect(emitMarketClosed).not.toHaveBeenCalled();
    });

    it('does not allow a settled market to be closed', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.SETTLED,
      });

      await expect(
        service.closeMarket('competition-1', 'market-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(marketUpdate).not.toHaveBeenCalled();
    });

    it('does not allow an already closed market to be closed again', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.CLOSED,
      });

      await expect(
        service.closeMarket('competition-1', 'market-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(marketUpdate).not.toHaveBeenCalled();
    });

    it('closes an open market', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.OPEN,
      });

      marketUpdate.mockResolvedValue({
        id: 'market-1',
        status: MarketStatus.CLOSED,
      });

      competitionUpdate.mockResolvedValue({
        id: 'competition-1',
      });

      const result = await service.closeMarket('competition-1', 'market-1');

      expect(marketUpdate).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
        },
        data: {
          status: MarketStatus.CLOSED,
        },
      });

      expect(competitionUpdate).toHaveBeenCalledTimes(1);

      const competitionUpdateCall = competitionUpdate.mock.calls[0]?.[0];

      expect(competitionUpdateCall).toBeDefined();

      expect(competitionUpdateCall?.where).toEqual({
        id: 'competition-1',
      });

      expect(competitionUpdateCall?.data.lastActivityAt).toBeInstanceOf(Date);

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
    it('settles bets, pays winners and finalises the market', async () => {
      const winningSelectionId = 'selection-1';
      const losingSelectionId = 'selection-2';

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

      const market = {
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.CLOSED,
        selections: [
          {
            id: winningSelectionId,
          },
          {
            id: losingSelectionId,
          },
        ],
      };

      marketFindFirst.mockResolvedValue(market);

      betFindMany.mockResolvedValue([winningBet, losingBet]);

      betUpdate.mockResolvedValue({
        id: 'updated-bet',
      });

      ledgerCreate.mockResolvedValue({
        id: 'ledger-1',
      });

      selectionUpdate.mockResolvedValue({
        id: 'updated-selection',
      });

      marketUpdate.mockResolvedValue({
        id: 'market-1',
        status: MarketStatus.SETTLED,
      });

      competitionUpdate.mockResolvedValue({
        id: 'competition-1',
      });

      createSnapshot.mockResolvedValue(undefined);

      const result = await service.settleMarket('competition-1', 'market-1', {
        winningSelectionId,
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

      expect(transaction).toHaveBeenCalledTimes(1);

      expect(betUpdate).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'bet-1',
        },
        data: {
          status: BetStatus.WON,
          settledAt: fixedNow,
        },
      });

      expect(betUpdate).toHaveBeenNthCalledWith(2, {
        where: {
          id: 'bet-2',
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

      expect(selectionUpdate).toHaveBeenNthCalledWith(1, {
        where: {
          id: winningSelectionId,
        },
        data: {
          status: SelectionStatus.WINNER,
        },
      });

      expect(selectionUpdate).toHaveBeenNthCalledWith(2, {
        where: {
          id: losingSelectionId,
        },
        data: {
          status: SelectionStatus.LOSER,
        },
      });

      expect(marketUpdate).toHaveBeenCalledWith({
        where: {
          id: 'market-1',
        },
        data: {
          status: MarketStatus.SETTLED,
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

      expect(result).toEqual(market);
    });

    it('rejects settlement when the market has no pending bets', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.CLOSED,
        selections: [
          {
            id: 'selection-1',
          },
          {
            id: 'selection-2',
          },
        ],
      });

      betFindMany.mockResolvedValue([]);

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId: 'selection-1',
        }),
      ).rejects.toThrow('No bets made against this market');

      expect(transaction).not.toHaveBeenCalled();
      expect(betUpdate).not.toHaveBeenCalled();
      expect(marketUpdate).not.toHaveBeenCalled();
      expect(createSnapshot).not.toHaveBeenCalled();
      expect(emitMarketSettled).not.toHaveBeenCalled();
    });
  });
});
