import { IsString, Length, Matches } from 'class-validator';

export class JoinCompetitionDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]+$/, { message: 'Join code must be A-Z and 0-9' })
  joinCode!: string;
}
