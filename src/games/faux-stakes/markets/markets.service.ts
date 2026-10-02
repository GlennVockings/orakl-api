import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
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
import { CreateMarketDto } from './dto/create-market.dto';
import { SettleMarketDto } from './dto/settle-market.dto';

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboardService: FauxStakesLeaderboardService,
    private readonly wsGateway: WsGateway,
  ) {}

  async createMarket(competitionId: string, dto: CreateMarketDto) {
    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      select: {
        id: true,
      },
    });

    if (!competition) {
      throw new BadRequestException('Competition does not exist');
    }

    const hasTeamSelections =
      dto.teamSelections !== undefined && dto.teamSelections.length > 0;

    const hasLabelSelections =
      dto.labelSelections !== undefined && dto.labelSelections.length > 0;

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

    let market: Prisma.MarketGetPayload<{
      include: {
        selections: {
          include: {
            team: true;
          };
        };
      };
    }>;

    try {
      market = await this.prisma.$transaction(async (tx) => {
        if (hasTeamSelections) {
          const teamIds = dto.teamSelections!.map(
            (selection) => selection.teamId,
          );

          const teams = await tx.team.findMany({
            where: {
              id: {
                in: teamIds,
              },
              competitionId,
            },
            select: {
              id: true,
            },
          });

          if (teams.length !== teamIds.length) {
            throw new BadRequestException(
              'One or more teamIds are invalid for this competition',
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
          const labels = dto.labelSelections!.map((selection) =>
            selection.label.trim(),
          );

          const uniqueLabels = new Set(
            labels.map((label) => label.toLowerCase()),
          );

          if (uniqueLabels.size !== labels.length) {
            throw new BadRequestException(
              'Duplicate labels are not allowed in a market',
            );
          }
        }

        const createdMarket = await tx.market.create({
          data: {
            competitionId,
            name: dto.name.trim(),
            status: MarketStatus.DRAFT,

            selections: hasTeamSelections
              ? {
                  create: dto.teamSelections!.map((selection) => ({
                    teamId: selection.teamId,
                    decimalOdds: new Prisma.Decimal(selection.decimalOdds ?? 2),
                  })),
                }
              : {
                  create: dto.labelSelections!.map((selection) => ({
                    label: selection.label.trim(),
                    decimalOdds: new Prisma.Decimal(selection.decimalOdds ?? 2),
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

        await tx.competition.update({
          where: {
            id: competitionId,
          },
          data: {
            lastActivityAt: now,
          },
        });

        return createdMarket;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A market with this name already exists in this competition',
        );
      }

      throw error;
    }

    this.wsGateway.emitMarketCreated(competitionId, {
      name: market.name,
    });

    return market;
  }

  async getMarkets(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      select: {
        id: true,
      },
    });

    if (!competition) {
      throw new BadRequestException('Competition does not exist');
    }

    return this.prisma.market.findMany({
      where: {
        competitionId,
      },

      orderBy: {
        createdAt: 'asc',
      },

      include: {
        selections: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async openMarket(competitionId: string, marketId: string) {
    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        competitionId,
      },
      select: {
        id: true,
      },
    });

    if (!market) {
      throw new BadRequestException(
        'Market does not exist for this competition',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.market.updateMany({
        where: {
          id: marketId,
          competitionId,
          status: MarketStatus.DRAFT,
        },

        data: {
          status: MarketStatus.OPEN,
        },
      });

      if (result.count !== 1) {
        throw new ForbiddenException('Only draft markets can be opened');
      }

      await tx.competition.update({
        where: {
          id: competitionId,
        },
        data: {
          lastActivityAt: now,
        },
      });
    });

    return {
      ok: true,
      marketId,
      status: MarketStatus.OPEN,
    };
  }

  async closeMarket(competitionId: string, marketId: string) {
    const now = new Date();

    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        competitionId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!market) {
      throw new BadRequestException(
        'Market does not exist for this competition',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.market.updateMany({
        where: {
          id: marketId,
          competitionId,
          status: MarketStatus.OPEN,
        },

        data: {
          status: MarketStatus.CLOSED,
        },
      });

      if (result.count !== 1) {
        throw new ForbiddenException('Only open markets can be closed');
      }

      await tx.competition.update({
        where: {
          id: competitionId,
        },
        data: {
          lastActivityAt: now,
        },
      });
    });

    this.wsGateway.emitMarketClosed(competitionId, {
      id: market.id,
      name: market.name,
    });

    return {
      ok: true,
      marketId,
      status: MarketStatus.CLOSED,
    };
  }

  async settleMarket(
    competitionId: string,
    marketId: string,
    dto: SettleMarketDto,
  ) {
    const now = new Date();

    const market = await this.prisma.market.findFirst({
      where: {
        id: marketId,
        competitionId,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!market) {
      throw new BadRequestException(
        'Market does not exist for this competition',
      );
    }

    /*
     * Everything above this boundary may fail normally.
     *
     * Everything inside this transaction is authoritative settlement
     * state. If any part fails, PostgreSQL rolls the entire settlement
     * back.
     */
    const settled = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.market.updateMany({
        where: {
          id: marketId,
          competitionId,
          status: MarketStatus.CLOSED,
        },

        data: {
          status: MarketStatus.SETTLED,
        },
      });

      if (claimed.count !== 1) {
        throw new ForbiddenException('Only closed markets can be resolved');
      }

      const selections = await tx.selection.findMany({
        where: {
          marketId,
        },

        select: {
          id: true,
        },
      });

      const winningSelection = selections.find(
        (selection) => selection.id === dto.winningSelectionId,
      );

      if (!winningSelection) {
        throw new BadRequestException(
          'Winning selection does not belong to this market',
        );
      }

      const selectionIds = selections.map((selection) => selection.id);

      const bets = await tx.bet.findMany({
        where: {
          competitionId,

          selectionId: {
            in: selectionIds,
          },

          status: BetStatus.PENDING,
        },
      });

      for (const bet of bets) {
        const hasWon = bet.selectionId === dto.winningSelectionId;

        const updatedBet = await tx.bet.updateMany({
          where: {
            id: bet.id,
            status: BetStatus.PENDING,
          },

          data: {
            status: hasWon ? BetStatus.WON : BetStatus.LOST,

            settledAt: now,
          },
        });

        if (updatedBet.count !== 1) {
          throw new BadRequestException(
            'A stake changed while this market was being resolved',
          );
        }

        if (hasWon) {
          await tx.competitionLedgerTxn.create({
            data: {
              competitionId,
              userId: bet.userId,

              type: LedgerType.PAYOUT,

              amount: bet.potentialReturn,

              betId: bet.id,
              marketId,
            },
          });
        }
      }

      await tx.selection.updateMany({
        where: {
          marketId,
        },

        data: {
          status: SelectionStatus.LOSER,
        },
      });

      await tx.selection.update({
        where: {
          id: dto.winningSelectionId,
        },

        data: {
          status: SelectionStatus.WINNER,
        },
      });

      await tx.competition.update({
        where: {
          id: competitionId,
        },

        data: {
          lastActivityAt: now,
        },
      });

      return {
        id: market.id,
        name: market.name,
        status: MarketStatus.SETTLED,
        winningSelectionId: dto.winningSelectionId,
      };
    });

    /*
     * IMPORTANT:
     *
     * From this point onward settlement has COMMITTED.
     *
     * Snapshot generation and realtime delivery are derived effects.
     * They are not allowed to turn successful settlement into an HTTP
     * failure.
     */

    try {
      await this.leaderboardService.createSnapshot(competitionId, marketId);
    } catch (error) {
      this.logger.error(
        `Settlement committed but leaderboard snapshot failed for market ${marketId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    try {
      this.wsGateway.emitMarketSettled(competitionId, {
        id: marketId,
        name: market.name,
        winningSelectionId: dto.winningSelectionId,
      });
    } catch (error) {
      this.logger.error(
        `Settlement committed but realtime notification failed for market ${marketId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return settled;
  }
}
