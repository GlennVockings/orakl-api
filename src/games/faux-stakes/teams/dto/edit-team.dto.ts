import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class EditTeamsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  newName!: string;

  @IsString()
  @MinLength(1)
  teamId!: string;

  @IsString()
  @MaxLength(50)
  oldName!: string;
}
