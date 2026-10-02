import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { DatabaseModule } from '../database/database.module';
import { AuthenticatedUserThrottlerGuard } from '../competitions/guards/authenticated-user-throttler.guard';

@Module({
  imports: [
    GameRegistryModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, AuthenticatedUserThrottlerGuard],
})
export class PlatformLeaderboardModule {}
