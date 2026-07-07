import { Module } from '@nestjs/common';
import { MarketsService } from './markets.service';
import { MarketsController } from './markets.controller';
import { PrismaService } from 'src/prisma.service';
import { GamesModule } from '../competitions/competitions.module';
import { WsModule } from '../realtime/ws.module';
import { LeaderboardService } from 'src/platform/leaderboard/leaderboard.service';

@Module({
  imports: [GamesModule, WsModule],
  controllers: [MarketsController],
  providers: [MarketsService, PrismaService, LeaderboardService],
  exports: [MarketsService],
})
export class MarketsModule {}
