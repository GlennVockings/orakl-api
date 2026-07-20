import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BetterAuthJwtGuard, CurrentUserId } from '../../../platform/auth';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { MarketsService } from './markets.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { SettleMarketDto } from './dto/settle-market.dto';

@Controller('/competitions/:competitionId/faux-stakes/markets')
export class MarketsController {
  constructor(
    private readonly markets: MarketsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async createMarket(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: CreateMarketDto,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.createMarket(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getMarkets(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.markets.getMarkets(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/settle')
  async settleMarket(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
    @Body() body: SettleMarketDto,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.settleMarket(competitionId, marketId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/close')
  async closeMarket(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.closeMarket(competitionId, marketId);
  }
}
