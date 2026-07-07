import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetterAuthJwtGuard } from 'src/platform/auth/better-auth-jwt.guard';
import { getUserIdFromJwtPayload } from 'src/platform/auth/auth-user';
import { CreateBetDto } from './dto/create-bet.dto';
import { GameAccessService } from '../competitions/competitions-access.service';

@Controller('/games/:gameId/bets')
export class BetsController {
  constructor(
    private bets: BetsService,
    private gameAccess: GameAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async placeBet(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Body() body: CreateBetDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.gameAccess.requireGameMember(userId, gameId);
    return this.bets.placeBet(userId, gameId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getUserBets(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.gameAccess.requireGameMember(userId, gameId);
    return this.bets.getUserBets(userId, gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':betId/undo')
  async undoBet(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Param('betId') betId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.gameAccess.requireGameMember(userId, gameId);
    return this.bets.undoBet(userId, gameId, betId);
  }
}
