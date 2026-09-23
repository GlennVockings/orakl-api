import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateBetDto {
  @IsString()
  marketId!: string;

  @IsString()
  selectionId!: string;

  @IsNumber()
  @Min(1)
  stake!: number;

  @IsUUID()
  idempotencyKey!: string;
}
