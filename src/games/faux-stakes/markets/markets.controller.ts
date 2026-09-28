import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BetterAuthJwtGuard } from '../../../platform/auth';
import { FauxStakesAdminGuard } from '../../../platform/competitions/guards/faux-stakes-admin.guard';
import { FauxStakesMemberGuard } from '../../../platform/competitions/guards/faux-stakes-member.guard';
import { CreateMarketDto } from './dto/create-market.dto';
import { SettleMarketDto } from './dto/settle-market.dto';
import { MarketsService } from './markets.service';

@Controller('/competitions/:competitionId/faux-stakes/markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Post()
  async createMarket(
    @Param('competitionId')
    competitionId: string,
    @Body() body: CreateMarketDto,
  ) {
    return this.markets.createMarket(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesMemberGuard)
  @Get()
  async getMarkets(
    @Param('competitionId')
    competitionId: string,
  ) {
    return this.markets.getMarkets(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Post(':marketId/settle')
  async settleMarket(
    @Param('competitionId')
    competitionId: string,
    @Param('marketId')
    marketId: string,
    @Body() body: SettleMarketDto,
  ) {
    return this.markets.settleMarket(competitionId, marketId, body);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Post(':marketId/open')
  async openMarket(
    @Param('competitionId')
    competitionId: string,
    @Param('marketId')
    marketId: string,
  ) {
    return this.markets.openMarket(competitionId, marketId);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Post(':marketId/close')
  async closeMarket(
    @Param('competitionId')
    competitionId: string,
    @Param('marketId')
    marketId: string,
  ) {
    return this.markets.closeMarket(competitionId, marketId);
  }
}
