import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { getUserIdFromJwtPayload } from '../auth/auth-user';
import { BetterAuthJwtGuard } from '../auth/better-auth-jwt.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('competitions')
@UseGuards(BetterAuthJwtGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':competitionId/leaderboard')
  getLeaderboard(
    @Req() req: Request,
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.leaderboardService.getLeaderboard(userId, competitionId);
  }
}
