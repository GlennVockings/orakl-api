import { Module } from '@nestjs/common';
import { AuthModule } from 'src/platform/auth/auth.module';
import { DatabaseModule } from 'src/platform/database/database.module';
import { FauxStakesLeaderboardService } from './faux-stakes-leaderboard.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [],
  providers: [FauxStakesLeaderboardService],
  exports: [FauxStakesLeaderboardService],
})
export class FauxStakesLeaderboardModule {}
