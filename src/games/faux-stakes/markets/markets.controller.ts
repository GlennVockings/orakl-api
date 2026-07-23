import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BetterAuthJwtGuard } from '../../../platform/auth';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { MarketsService } from './markets.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { SettleMarketDto } from './dto/settle-market.dto';
import { CompetitionAdminGuard } from 'src/platform/competitions/guards/competition-admin.guard';
import { CompetitionMemberGuard } from 'src/platform/competitions/guards/competition-member.guard';

@Controller('/competitions/:competitionId/faux-stakes/markets')
export class MarketsController {
  constructor(
    private readonly markets: MarketsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard, CompetitionAdminGuard)
  @Post()
  async createMarket(
    @Param('competitionId') competitionId: string,
    @Body() body: CreateMarketDto,
  ) {
    return this.markets.createMarket(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionMemberGuard)
  @Get()
  async getMarkets(@Param('competitionId') competitionId: string) {
    return this.markets.getMarkets(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionAdminGuard)
  @Post(':marketId/settle')
  async settleMarket(
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
    @Body() body: SettleMarketDto,
  ) {
    return this.markets.settleMarket(competitionId, marketId, body);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionAdminGuard)
  @Post(':marketId/close')
  async closeMarket(
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
  ) {
    return this.markets.closeMarket(competitionId, marketId);
  }
}
