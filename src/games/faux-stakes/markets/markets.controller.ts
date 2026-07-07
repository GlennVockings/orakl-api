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

@Controller('games/:gameId/markets')
export class MarketsController {
  constructor(
    private markets: MarketsService,
    private competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async createMarket(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Body() body: CreateMarketDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, gameId);
    return this.markets.createMarket(gameId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getMarkets(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(userId, gameId);
    return this.markets.getMarkets(gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/settle')
  async settleMarket(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Param('marketId') marketId: string,
    @Body() body: SettleMarketDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, gameId);
    return this.markets.settleMarket(gameId, marketId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':marketId/close')
  async closeMarket(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Param('marketId') marketId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, gameId);
    return this.markets.closeMarket(gameId, marketId);
  }
}
