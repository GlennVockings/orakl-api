import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GameType } from 'src/platform/game-registry/game-type';

const GAME_TYPES: GameType[] = ['FAUX_STAKES', 'PREDICTOR'];

export class CreateCompetitionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(GAME_TYPES)
  gameType!: GameType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
