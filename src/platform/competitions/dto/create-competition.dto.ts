import { IsOptional, IsString } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsOptional()
  config?: unknown;
}
