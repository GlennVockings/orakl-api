import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { GameType } from 'src/platform/game-registry/game-type';

const GAME_TYPES: GameType[] = ['FAUX_STAKES', 'PREDICTOR'];

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsIn(GAME_TYPES)
  gameType!: GameType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
