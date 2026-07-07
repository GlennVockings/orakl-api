import { IsString } from 'class-validator';

export class SettleMarketDto {
  @IsString()
  winningSelectionId!: string;
}
