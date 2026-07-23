import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketStatus } from '@prisma/client';
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
  const marketFindFirst = jest.fn();
  const marketUpdate = jest.fn();
  const competitionUpdate = jest.fn<
    Promise<{ id: string }>,
    [CompetitionUpdateArgs]
  >();
  const betFindMany = jest.fn();
  const selectionUpdate = jest.fn();
  const ledgerCreate = jest.fn();

  const transactionClient = {
    market: {
      update: marketUpdate,
    },
    competition: {
      update: competitionUpdate,
    },
    bet: {
      findMany: betFindMany,
      update: jest.fn(),
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
    createSnapshot: jest.fn(),
  } as unknown as FauxStakesLeaderboardService;

  const emitMarketClosed = jest.fn();
  const emitMarketSettled = jest.fn();

  const wsGateway = {
    emitMarketClosed,
    emitMarketSettled,
  } as unknown as WsGateway;

  let service: MarketsService;

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    service = new MarketsService(prisma, leaderboardService, wsGateway);
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
    it('only allows a closed market to be settled', async () => {
      marketFindFirst.mockResolvedValue({
        id: 'market-1',
        name: 'Premier League winner',
        status: MarketStatus.OPEN,
        selections: [],
      });

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId: 'selection-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects a winning selection from another market', async () => {
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

      await expect(
        service.settleMarket('competition-1', 'market-1', {
          winningSelectionId: 'selection-from-another-market',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
