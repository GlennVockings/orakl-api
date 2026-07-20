import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BetterAuthJwtGuard, CurrentUserId } from '../auth';
import { LeaderboardService } from './leaderboard.service';

@Controller('competitions')
@UseGuards(BetterAuthJwtGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':competitionId/leaderboard')
  getLeaderboard(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.leaderboardService.getLeaderboard(userId, competitionId);
  }
}
