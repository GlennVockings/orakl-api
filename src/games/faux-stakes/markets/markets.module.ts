import { Module } from '@nestjs/common';
import { MarketsService } from './markets.service';
import { MarketsController } from './markets.controller';
import { PrismaService } from 'src/prisma.service';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { WsModule } from '../realtime/ws.module';
import { FauxStakesLeaderboardService } from 'src/games/faux-stakes/leaderboard/faux-stakes-leaderboard.service';

@Module({
  imports: [CompetitionsModule, WsModule],
  controllers: [MarketsController],
  providers: [MarketsService, PrismaService, FauxStakesLeaderboardService],
  exports: [MarketsService],
})
export class MarketsModule {}
