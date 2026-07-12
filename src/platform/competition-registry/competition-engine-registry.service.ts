import { Injectable } from '@nestjs/common';
import { FauxStakesEngine } from '../../games/faux-stakes/engine/faux-stakes.engine';
import { GameEngine } from './competition-engine.interface';
import { GameType } from './competition-type';

@Injectable()
export class GameEngineRegistryService {
  private readonly engines: Map<GameType, GameEngine>;

  constructor(private readonly fauxStakesEngine: FauxStakesEngine) {
    this.engines = new Map<GameType, GameEngine>([
      [this.fauxStakesEngine.gameType, this.fauxStakesEngine],
    ]);
  }

  get(gameType: GameType): GameEngine {
    const engine = this.engines.get(gameType);

    if (!engine) {
      throw new Error(`No game engine registered for game type: ${gameType}`);
    }

    return engine;
  }
}
