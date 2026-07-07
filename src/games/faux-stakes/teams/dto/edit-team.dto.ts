import { IsString, MaxLength } from 'class-validator';

export class EditTeamsDto {
  @IsString()
  @MaxLength(50, { each: true })
  newName!: string;

  @IsString()
  teamId!: string;

  @IsString()
  @MaxLength(50, { each: true })
  oldName!: string;
}
