import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [GameRegistryModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, PrismaService],
})
export class PlatformLeaderboardModule {}
