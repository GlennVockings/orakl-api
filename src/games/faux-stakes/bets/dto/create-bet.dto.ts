import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';

const MAX_STAKE = 1_000_000;

export class CreateBetDto {
  @IsString()
  marketId!: string;

  @IsString()
  selectionId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_STAKE)
  stake!: number;

  @IsUUID()
  idempotencyKey!: string;
}
