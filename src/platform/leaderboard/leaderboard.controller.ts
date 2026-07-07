import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { getUserIdFromJwtPayload } from '../auth/auth-user';
import { BetterAuthJwtGuard } from '../auth/better-auth-jwt.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('games')
@UseGuards(BetterAuthJwtGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':gameId/leaderboard')
  getLeaderboard(@Req() req: Request, @Param('gameId') gameId: string) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.leaderboardService.getLeaderboard(userId, gameId);
  }
}
