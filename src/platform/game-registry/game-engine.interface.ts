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

export interface CompetitionCreatedContext {
  competitionId: string;
  hostUserId: string;
  config?: unknown;
}

export type GamePlayerState = Record<string, unknown>;

export interface GameEngine {
  gameType: GameType;

  isEnabled(): boolean;

  getLeaderboard(competitionId: string): Promise<LeaderboardRow[]>;

  getPlayerState?(
    userId: string,
    competitionId: string,
  ): Promise<GamePlayerState>;

  onCompetitionCreated?(context: CompetitionCreatedContext): Promise<void>;

  onUserJoined?(userId: string, competitionId: string): Promise<void>;
}
