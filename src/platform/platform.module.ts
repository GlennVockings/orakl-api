import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { GameRegistryModule } from './competition-registry/competition-registry.module';
import { PlatformLeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [AuthModule, GameRegistryModule, PlatformLeaderboardModule],
  exports: [AuthModule, GameRegistryModule, PlatformLeaderboardModule],
})
export class PlatformModule {}
