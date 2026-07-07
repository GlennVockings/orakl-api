import { IsNumber, IsString, Min } from 'class-validator';

export class CreateBetDto {
  @IsString()
  marketId!: string;

  @IsString()
  selectionId!: string;

  @IsNumber()
  @Min(1)
  stake!: number;
}
