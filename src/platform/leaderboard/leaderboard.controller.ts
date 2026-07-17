import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { getUserIdFromJwtPayload } from '../auth/auth-user';
import { BetterAuthJwtGuard } from '../auth/better-auth-jwt.guard';
import { LeaderboardService } from './leaderboard.service';

import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user: unknown;
};

@Controller('competitions')
@UseGuards(BetterAuthJwtGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':competitionId/leaderboard')
  getLeaderboard(
    @Req() req: AuthenticatedRequest,
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.leaderboardService.getLeaderboard(userId, competitionId);
  }
}
