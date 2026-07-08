import { Module } from '@nestjs/common';
import { FauxStakesEngine } from '../../games/faux-stakes/engine/faux-stakes.engine';
import { FauxStakesLeaderboardModule } from '../../games/faux-stakes/leaderboard/faux-stakes-leaderboard.module';
import { WsModule } from '../../games/faux-stakes/realtime/ws.module';
import { DatabaseModule } from '../database/database.module';
import { GameEngineRegistryService } from './game-engine-registry.service';

@Module({
  imports: [DatabaseModule, FauxStakesLeaderboardModule, WsModule],
  providers: [FauxStakesEngine, GameEngineRegistryService],
  exports: [GameEngineRegistryService],
})
export class GameRegistryModule {}
