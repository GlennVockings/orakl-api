import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTeamsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
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
