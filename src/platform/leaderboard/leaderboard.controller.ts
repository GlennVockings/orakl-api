import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BetterAuthJwtGuard, CurrentUserId } from '../auth';
import { AuthenticatedUserThrottlerGuard } from '../competitions/guards/authenticated-user-throttler.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('competitions')
@UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':competitionId/leaderboard')
  getLeaderboard(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.leaderboardService.getLeaderboard(userId, competitionId);
  }
}
