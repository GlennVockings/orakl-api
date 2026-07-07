import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TeamSelectionDto {
  @IsString()
  teamId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1.01)
  decimalOdds?: number;
}

class LabelSelectionDto {
  @IsString()
  @MaxLength(50)
  label!: string;

  @IsOptional()
  @IsNumber()
  @Min(1.01)
  decimalOdds?: number;
}

export class CreateMarketDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @ValidateIf((o: { labelSelections: LabelSelectionDto }) => !o.labelSelections)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TeamSelectionDto)
  teamSelections?: TeamSelectionDto[];

  @ValidateIf((o: { teamSelections: TeamSelectionDto }) => !o.teamSelections)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LabelSelectionDto)
  labelSelections?: LabelSelectionDto[];
}
