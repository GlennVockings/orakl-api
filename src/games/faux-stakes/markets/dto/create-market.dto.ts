import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const MIN_DECIMAL_ODDS = 1.01;
const MAX_DECIMAL_ODDS = 1000;

class TeamSelectionDto {
  @IsString()
  @MinLength(1)
  teamId!: string;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(MIN_DECIMAL_ODDS)
  @Max(MAX_DECIMAL_ODDS)
  decimalOdds?: number;
}

class LabelSelectionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label!: string;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(MIN_DECIMAL_ODDS)
  @Max(MAX_DECIMAL_ODDS)
  decimalOdds?: number;
}

export class CreateMarketDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ValidateIf((value: CreateMarketDto) => !value.labelSelections)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TeamSelectionDto)
  teamSelections?: TeamSelectionDto[];

  @ValidateIf((value: CreateMarketDto) => !value.teamSelections)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LabelSelectionDto)
  labelSelections?: LabelSelectionDto[];
}
