import { BadRequestException } from '@nestjs/common';
import type { CompetitionRequest } from '../types/authenticated-request';

export function getCompetitionId(request: CompetitionRequest): string {
  const competitionId = request.params.competitionId;

  if (!competitionId || Array.isArray(competitionId)) {
    throw new BadRequestException('Competition ID was not provided');
  }

  return competitionId;
}
