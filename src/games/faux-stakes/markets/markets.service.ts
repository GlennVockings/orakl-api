import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateMarketDto } from './dto/create-market.dto';
import {
  BetStatus,
  LedgerType,
  MarketStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { WsGateway } from '../realtime/ws.gateway';
import { SettleMarketDto } from './dto/settle-market.dto';
import { LeaderboardService } from 'src/platform/leaderboard/leaderboard.service';

@Injectable()
export class MarketsService {
  constructor(
    private prisma: PrismaService,
    private leaderboardService: LeaderboardService,
    private wsGateway: WsGateway,
  ) {}

  async createMarket(gameId: string, dto: CreateMarketDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });

    if (!game) {
      throw new BadRequestException('Game does not exist');
    }

    const hasTeamSelections =
      dto.teamSelections && dto.teamSelections.length > 0;
    const hasLabelSelections =
      dto.labelSelections && dto.labelSelections.length > 0;

    if (!hasTeamSelections && !hasLabelSelections) {
      throw new BadRequestException(
        'A market must have either teamSelections or labelSelections',
      );
    }

    if (hasTeamSelections && hasLabelSelections) {
      throw new BadRequestException(
        'A market cannot have both teamSelections and labelSelections',
      );
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // If using teams, validate team ids belong to this game
      if (hasTeamSelections) {
        const teamIds = dto.teamSelections!.map((s) => s.teamId);

        const teams = await tx.team.findMany({
          where: {
            id: { in: teamIds },
            gameId,
          },
          select: { id: true },
        });

        if (teams.length !== teamIds.length) {
          throw new BadRequestException(
            'One or more teamIds are invalid for this game',
          );
        }

        const uniqueTeamIds = new Set(teamIds);
        if (uniqueTeamIds.size !== teamIds.length) {
          throw new BadRequestException(
            'Duplicate teamIds are not allowed in a market',
          );
        }
      }

      if (hasLabelSelections) {
        const labels = dto.labelSelections!.map((s) => s.label.trim());

        const uniqueLabels = new Set(labels.map((l) => l.toLowerCase()));
        if (uniqueLabels.size !== labels.length) {
          throw new BadRequestException(
            'Duplicate labels are not allowed in a market',
          );
        }
      }

      const market = await tx.market.create({
        data: {
          gameId,
          name: dto.name,
          status: 'OPEN',
          selections: hasTeamSelections
            ? {
                create: dto.teamSelections!.map((selection) => ({
                  teamId: selection.teamId,
                  decimalOdds: new Prisma.Decimal(selection.decimalOdds ?? 2.0),
                })),
              }
            : {
                create: dto.labelSelections!.map((selection) => ({
                  label: selection.label.trim(),
                  decimalOdds: new Prisma.Decimal(selection.decimalOdds ?? 2.0),
                })),
              },
        },
        include: {
          selections: {
            include: {
              team: true,
            },
          },
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: {
          lastActivityAt: now,
        },
      });

      this.wsGateway.emitMarketCreated(gameId, {
        name: dto.name,
      });

      return market;
    });
  }

  async getMarkets(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });

    if (!game) {
      throw new BadRequestException('Game does not exist');
    }

    return this.prisma.market.findMany({
      where: { gameId },
      orderBy: { createdAt: 'asc' },
      include: {
        selections: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async closeMarket(gameId: string, marketId: string) {
    const now = new Date();

    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        gameId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!market) {
      throw new BadRequestException('Market does not exist for this game');
    }

    if (market.status === 'SETTLED') {
      throw new ForbiddenException('Settled markets cannot be closed');
    }

    if (market.status === 'CLOSED') {
      throw new ForbiddenException('Market is already closed');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.market.update({
        where: { id: marketId },
        data: { status: MarketStatus.CLOSED },
      });

      await tx.game.update({
        where: { id: gameId },
        data: { lastActivityAt: now },
      });
    });

    this.wsGateway.emitMarketClosed(gameId, {
      id: market.id,
      name: market.name,
    });

    return {
      ok: true,
      marketId,
      status: MarketStatus.CLOSED,
    };
  }

  async settleMarket(gameId: string, marketId: string, dto: SettleMarketDto) {
    const now = new Date();

    const market = await this.prisma.market.findFirst({
      where: {
        gameId,
        id: marketId,
      },
      select: {
        id: true,
        name: true,
        selections: true,
        status: true,
      },
    });

    if (!market) {
      throw new BadRequestException('Market does not exist for this game');
    }

    if (market.status !== MarketStatus.CLOSED) {
      throw new ForbiddenException('Only closed markets can be settled');
    }

    const winningSelection = market.selections.find(
      (selection) => selection.id === dto.winningSelectionId,
    );

    if (!winningSelection) {
      throw new BadRequestException(
        'Winning selection does not belong to this market',
      );
    }

    const marketSelections = market.selections.map((selection) => selection.id);

    const bets = await this.prisma.bet.findMany({
      where: {
        gameId,
        selectionId: {
          in: marketSelections,
        },
        status: BetStatus.PENDING,
      },
    });

    if (bets.length < 1) {
      throw new BadRequestException('No bets made against this market');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const bet of bets) {
        const hasWon = bet.selectionId === dto.winningSelectionId;

        await tx.bet.update({
          where: {
            id: bet.id,
          },
          data: {
            status: hasWon ? BetStatus.WON : BetStatus.LOST,
            settledAt: now,
          },
        });

        if (!hasWon) continue;

        await tx.gameLedgerTxn.create({
          data: {
            gameId,
            userId: bet.userId,
            type: LedgerType.PAYOUT,
            amount: bet.potentialReturn,
            betId: bet.id,
            marketId: marketId,
          },
        });
      }

      for (const selection of marketSelections) {
        await tx.selection.update({
          where: {
            id: selection,
          },
          data: {
            status:
              selection === dto.winningSelectionId
                ? SelectionStatus.WINNER
                : SelectionStatus.LOSER,
          },
        });
      }

      await tx.market.update({
        where: { id: marketId },
        data: {
          status: MarketStatus.SETTLED,
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: { lastActivityAt: now },
      });
    });

    await this.leaderboardService.createSnapshot(gameId, marketId);

    this.wsGateway.emitMarketSettled(gameId, {
      id: marketId,
      name: market.name,
      winningSelectionId: dto.winningSelectionId,
    });

    return market;
  }
}
