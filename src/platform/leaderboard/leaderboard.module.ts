import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, PrismaService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
