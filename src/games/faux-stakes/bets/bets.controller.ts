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
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';

@Controller('/competitions/:competitionId/faux-stakes/bets')
export class BetsController {
  constructor(
    private readonly betsService: BetsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async placeBet(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Body() body: CreateBetDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.betsService.placeBet(userId, competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getUserBets(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.betsService.getUserBets(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post(':betId/undo')
  async undoBet(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Param('betId') betId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.betsService.undoBet(userId, competitionId, betId);
  }
}
