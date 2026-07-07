import { Module } from '@nestjs/common';
import { FauxStakesEngine } from '../../games/faux-stakes/engine/faux-stakes.engine';
import { PlatformLeaderboardModule } from '../leaderboard/leaderboard.module';
import { GameEngineRegistryService } from './game-engine-registry.service';

@Module({
  imports: [PlatformLeaderboardModule],
  providers: [FauxStakesEngine, GameEngineRegistryService],
  exports: [GameEngineRegistryService],
})
export class GameRegistryModule {}
