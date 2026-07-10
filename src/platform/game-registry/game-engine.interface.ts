import { GameType } from './game-type';

export interface LeaderboardRow {
  userId: string;
  displayName: string | null;
  currentBalance?: number;
  settledBalance?: number;
  rank: number;
  previousRank?: number | null;
  rankDelta?: number | null;
}

export interface CompetitionContext {
  competitionId: string;
}

export interface CompetitionUserContext extends CompetitionContext {
  userId: string;
}

export interface CompetitionCreatedContext extends CompetitionContext {
  hostUserId: string;
  config?: unknown;
}

export type GamePlayerState = Record<string, unknown>;

export interface GameCompetitionSummary {
  summary: Record<string, unknown>;
  membership: Record<string, unknown>;
}

export interface GameEngine {
  gameType: GameType;

  isEnabled(): boolean;

  getLeaderboard(context: CompetitionContext): Promise<LeaderboardRow[]>;

  getPlayerState?(context: CompetitionUserContext): Promise<GamePlayerState>;

  getCompetitionSummary?(
    context: CompetitionUserContext,
  ): Promise<GameCompetitionSummary>;

  onCompetitionCreated?(context: CompetitionCreatedContext): Promise<void>;

  onUserJoined?(context: CompetitionUserContext): Promise<void>;
}
