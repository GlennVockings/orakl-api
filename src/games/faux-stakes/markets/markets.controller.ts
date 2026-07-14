import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BetterAuthJwtGuard } from '../../../platform/auth/better-auth-jwt.guard';
import { getUserIdFromJwtPayload } from '../../../platform/auth/auth-user';
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
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Body() body: CreateMarketDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.createMarket(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getMarkets(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.markets.getMarkets(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/settle')
  async settleMarket(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
    @Body() body: SettleMarketDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.settleMarket(competitionId, marketId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/close')
  async closeMarket(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Param('marketId') marketId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.markets.closeMarket(competitionId, marketId);
  }
}
