/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { BetterAuthJwtGuard } from '../auth/better-auth-jwt.guard';
import { getUserIdFromJwtPayload } from '../auth/auth-user';

@Controller('games')
export class LeaderboardController {
  constructor(private leaderboard: LeaderboardService) {}

  @UseGuards(BetterAuthJwtGuard)
  @Get(':gameId/leaderboard')
  async getLeaderboard(@Req() req: any, @Param('gameId') gameId: string) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.leaderboard.getLeaderboard(userId, gameId);
  }
}
