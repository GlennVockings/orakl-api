import { Module } from '@nestjs/common';
import { MarketsService } from './markets.service';
import { MarketsController } from './markets.controller';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { WsModule } from '../realtime/ws.module';
import { FauxStakesLeaderboardService } from 'src/games/faux-stakes/leaderboard/faux-stakes-leaderboard.service';
import { DatabaseModule } from 'src/platform/database/database.module';

@Module({
  imports: [CompetitionsModule, WsModule, DatabaseModule],
  controllers: [MarketsController],
  providers: [MarketsService, FauxStakesLeaderboardService],
  exports: [MarketsService],
})
export class MarketsModule {}
