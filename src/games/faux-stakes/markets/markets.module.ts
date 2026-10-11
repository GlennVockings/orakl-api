import { Module } from '@nestjs/common';
import { FauxStakesLeaderboardService } from 'src/games/faux-stakes/leaderboard/faux-stakes-leaderboard.service';
import { AuthModule } from 'src/platform/auth/auth.module';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { DatabaseModule } from 'src/platform/database/database.module';
import { WsModule } from '../realtime/ws.module';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  imports: [AuthModule, CompetitionsModule, WsModule, DatabaseModule],
  controllers: [MarketsController],
  providers: [MarketsService, FauxStakesLeaderboardService],
  exports: [MarketsService],
})
export class MarketsModule {}
