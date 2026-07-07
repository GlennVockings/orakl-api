import { Module } from '@nestjs/common';
import { FauxStakesLeaderboardService } from './faux-stakes-leaderboard.service';
import { DatabaseModule } from 'src/platform/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [FauxStakesLeaderboardService],
  exports: [FauxStakesLeaderboardService],
})
export class FauxStakesLeaderboardModule {}
