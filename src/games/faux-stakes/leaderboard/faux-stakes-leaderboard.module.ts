import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FauxStakesLeaderboardService } from './faux-stakes-leaderboard.service';

@Module({
  controllers: [],
  providers: [FauxStakesLeaderboardService, PrismaService],
  exports: [FauxStakesLeaderboardService],
})
export class FauxStakesLeaderboardModule {}
