import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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

    const market = await this.prisma.$transaction(async (tx) => {
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

        if (labels.some((label) => label.length === 0)) {
          throw new BadRequestException('Market outcomes cannot be empty');
        }

        const uniqueLabels = new Set(
          labels.map((label) => label.toLowerCase()),
        );

        if (uniqueLabels.size !== labels.length) {
          throw new BadRequestException(
            'Duplicate labels are not allowed in a market',
          );
        }
      }

      /*
       * Markets are deliberately created as DRAFT.
       *
       * Competition status is not the gameplay gate. Each market owns its
       * own lifecycle:
       *
       * DRAFT -> OPEN -> CLOSED -> SETTLED
       */
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

    /*
     * WebSocket events are external side effects, so they happen after
     * the database transaction has successfully committed.
     */
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

    /*
     * Notice that we do NOT include bets here.
     *
     * Before resolution, members may see markets and selections but not
     * other players' selections, amounts, counts or aggregate stake data.
     */
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
      /*
       * Compare-and-swap:
       *
       * Only DRAFT may become OPEN.
       *
       * Two simultaneous Open requests cannot both succeed.
       */
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
      /*
       * This update competes for the same Market row lock used by
       * placeBet() and undoBet().
       *
       * Therefore there is a definite ordering:
       *
       * stake/undo commits first -> then market closes
       * OR
       * market closes first -> stake/undo is rejected
       */
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

    const settled = await this.prisma.$transaction(async (tx) => {
      /*
       * Claim the CLOSED -> SETTLED transition first.
       *
       * This is the settlement mutex. Only one request can successfully
       * claim a CLOSED market.
       */
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

      /*
       * Everything used to determine the result is now loaded inside the
       * transaction after we own the settlement transition.
       */
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

      if (bets.length < 1) {
        throw new BadRequestException('No bets made against this market');
      }

      for (const bet of bets) {
        const hasWon = bet.selectionId === dto.winningSelectionId;

        /*
         * Include PENDING in the write condition.
         *
         * This is another compare-and-swap: settlement is only allowed
         * to consume a bet that is still pending.
         */
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

      /*
       * First make every selection a loser, then promote the winner.
       *
       * This is both simpler and cheaper than issuing one UPDATE per
       * selection.
       */
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
     * The actual game settlement has committed before these secondary
     * effects run.
     *
     * WebSocket delivery is not allowed to determine whether players
     * receive their payout.
     */
    await this.leaderboardService.createSnapshot(competitionId, marketId);

    this.wsGateway.emitMarketSettled(competitionId, {
      id: marketId,
      name: market.name,
      winningSelectionId: dto.winningSelectionId,
    });

    return settled;
  }
}
