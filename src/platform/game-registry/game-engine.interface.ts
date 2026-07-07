export type GameType = 'FAUX_STAKES' | 'PREDICTOR';

export interface LeaderboardRow {
  userId: string;
  displayName: string | null;
  currentBalance?: number;
  settledBalance?: number;
  rank: number;
  previousRank?: number | null;
  rankDelta?: number | null;
}

export interface GameEngine {
  gameType: GameType;

  isEnabled(): boolean;

  getLeaderboard(
    userId: string,
    competitionId: string,
  ): Promise<LeaderboardRow[]>;
}
