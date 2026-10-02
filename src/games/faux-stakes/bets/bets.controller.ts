import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BetterAuthJwtGuard, CurrentUserId } from 'src/platform/auth';
import { AuthenticatedUserThrottlerGuard } from 'src/platform/competitions/guards/authenticated-user-throttler.guard';
import { FauxStakesMemberGuard } from 'src/platform/competitions/guards/faux-stakes-member.guard';
import { BetsService } from './bets.service';
import { CreateBetDto } from './dto/create-bet.dto';

@Controller('/competitions/:competitionId/faux-stakes/bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @UseGuards(
    BetterAuthJwtGuard,
    FauxStakesMemberGuard,
    AuthenticatedUserThrottlerGuard,
  )
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post()
  async placeBet(
    @CurrentUserId() userId: string,
    @Param('competitionId')
    competitionId: string,
    @Body() body: CreateBetDto,
  ) {
    return this.betsService.placeBet(userId, competitionId, body);
  }

  @UseGuards(
    BetterAuthJwtGuard,
    FauxStakesMemberGuard,
    AuthenticatedUserThrottlerGuard,
  )
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  async getUserBets(
    @CurrentUserId() userId: string,
    @Param('competitionId')
    competitionId: string,
  ) {
    return this.betsService.getUserBets(userId, competitionId);
  }

  @UseGuards(
    BetterAuthJwtGuard,
    FauxStakesMemberGuard,
    AuthenticatedUserThrottlerGuard,
  )
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':betId/undo')
  async undoBet(
    @CurrentUserId() userId: string,
    @Param('competitionId')
    competitionId: string,
    @Param('betId')
    betId: string,
  ) {
    return this.betsService.undoBet(userId, competitionId, betId);
  }
}
