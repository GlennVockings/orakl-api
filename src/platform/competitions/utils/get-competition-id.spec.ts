import { BadRequestException } from '@nestjs/common';
import type { CompetitionRequest } from '../types/authenticated-request';
import { getCompetitionId } from './get-competition-id';

describe('getCompetitionId', () => {
  it('returns the competition ID', () => {
    const request = {
      params: {
        competitionId: 'competition-1',
      },
    } as unknown as CompetitionRequest;

    expect(getCompetitionId(request)).toBe('competition-1');
  });

  it('throws when the competition ID is missing', () => {
    const request = {
      params: {},
    } as unknown as CompetitionRequest;

    expect(() => getCompetitionId(request)).toThrow(BadRequestException);
  });

  it('throws when competition ID is an array', () => {
    const request = {
      params: {
        competitionId: ['competition-1', 'competition-2'],
      },
    } as unknown as CompetitionRequest;

    expect(() => getCompetitionId(request)).toThrow(BadRequestException);
  });
});
