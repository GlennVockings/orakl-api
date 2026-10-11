import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function trimStringArray(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const items: unknown[] = value;

  return items.map((item): unknown => {
    if (typeof item === 'string') {
      return item.trim();
    }

    return item;
  });
}

export class CreateTeamsDto {
  @Transform(({ value }: { value: unknown }) => trimStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  names!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  emoji?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
