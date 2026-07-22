import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetterAuthJwtGuard, CurrentUserId } from 'src/platform/auth';
import { CreateBetDto } from './dto/create-bet.dto';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { GameType } from '@prisma/client';

@Controller('/competitions/:competitionId/faux-stakes/bets')
export class BetsController {
  constructor(
    private readonly betsService: BetsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async placeBet(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: CreateBetDto,
  ) {
    await this.competitionAccess.requireGameCompetition(
      userId,
      competitionId,
      GameType.FAUX_STAKES,
    );
    return this.betsService.placeBet(userId, competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getUserBets(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireGameCompetition(
      userId,
      competitionId,
      GameType.FAUX_STAKES,
    );
    return this.betsService.getUserBets(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':betId/undo')
  async undoBet(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Param('betId') betId: string,
  ) {
    await this.competitionAccess.requireGameCompetition(
      userId,
      competitionId,
      GameType.FAUX_STAKES,
    );
    return this.betsService.undoBet(userId, competitionId, betId);
  }
}
