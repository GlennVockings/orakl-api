import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetterAuthJwtGuard, CurrentUserId } from 'src/platform/auth';
import { CreateBetDto } from './dto/create-bet.dto';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { CompetitionMemberGuard } from 'src/platform/competitions/guards/competition-member.guard';

@Controller('/competitions/:competitionId/faux-stakes/bets')
export class BetsController {
  constructor(
    private readonly betsService: BetsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard, CompetitionMemberGuard)
  @Post()
  async placeBet(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: CreateBetDto,
  ) {
    return this.betsService.placeBet(userId, competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionMemberGuard)
  @Get()
  async getUserBets(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.betsService.getUserBets(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionMemberGuard)
  @Post(':betId/undo')
  async undoBet(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Param('betId') betId: string,
  ) {
    return this.betsService.undoBet(userId, competitionId, betId);
  }
}
