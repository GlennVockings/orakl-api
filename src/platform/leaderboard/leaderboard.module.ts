import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedUserThrottlerGuard } from '../competitions/guards/authenticated-user-throttler.guard';
import { DatabaseModule } from '../database/database.module';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [
    AuthModule,
    GameRegistryModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, AuthenticatedUserThrottlerGuard],
})
export class PlatformLeaderboardModule {}
