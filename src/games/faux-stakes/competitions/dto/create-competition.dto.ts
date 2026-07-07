import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  startingChips?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  teamNames?: string[];
}
