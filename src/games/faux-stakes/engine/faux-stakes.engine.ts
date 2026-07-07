import { Injectable } from '@nestjs/common';
import {
  GameEngine,
  GameType,
  LeaderboardRow,
} from '../../../platform/game-registry/game-engine.interface';
import { FauxStakesLeaderboardService } from '../leaderboard/faux-stakes-leaderboard.service';

@Injectable()
export class FauxStakesEngine implements GameEngine {
  gameType: GameType = 'FAUX_STAKES';

  constructor(
    private readonly leaderboardService: FauxStakesLeaderboardService,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  getLeaderboard(competitionId: string): Promise<LeaderboardRow[]> {
    return this.leaderboardService.getLeaderboardForCompetition(competitionId);
  }
}
