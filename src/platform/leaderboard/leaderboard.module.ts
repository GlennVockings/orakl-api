import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../competition-registry/competition-registry.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [GameRegistryModule, DatabaseModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class PlatformLeaderboardModule {}
