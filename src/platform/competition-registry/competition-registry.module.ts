import { Module } from '@nestjs/common';
import { FauxStakesEngine } from '../../games/faux-stakes/engine/faux-stakes.engine';
import { FauxStakesLeaderboardModule } from '../../games/faux-stakes/leaderboard/faux-stakes-leaderboard.module';
import { WsModule } from '../../games/faux-stakes/realtime/ws.module';
import { DatabaseModule } from '../database/database.module';
import { GameEngineRegistryService } from './competition-engine-registry.service';
import { FauxStakesConfigService } from '../../games/faux-stakes/config/faux-stakes-config.service';

@Module({
  imports: [DatabaseModule, FauxStakesLeaderboardModule, WsModule],
  providers: [
    FauxStakesEngine,
    FauxStakesConfigService,
    GameEngineRegistryService,
  ],
  exports: [GameEngineRegistryService],
})
export class GameRegistryModule {}
