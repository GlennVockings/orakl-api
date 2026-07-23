import type { CompetitionMember } from '@prisma/client';
import type { Request } from 'express';

export interface CompetitionRequest extends Request {
  user?: {
    id?: string;
  };

  competitionMember?: CompetitionMember;
}
