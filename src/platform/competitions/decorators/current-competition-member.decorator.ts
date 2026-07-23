import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { CompetitionMember } from '@prisma/client';
import type { CompetitionRequest } from '../types/authenticated-request';

export const CurrentCompetitionMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CompetitionMember => {
    const request = context.switchToHttp().getRequest<CompetitionRequest>();

    if (!request.competitionMember) {
      throw new InternalServerErrorException(
        'Competition membership was not attached to the request',
      );
    }

    return request.competitionMember;
  },
);
