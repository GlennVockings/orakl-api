import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CompetitionMember } from '@prisma/client';
import { MemberRole } from '@prisma/client';
import { CompetitionAccessService } from '../competition-access.service';
import type { CompetitionRequest } from '../types/authenticated-request';
import { CompetitionMemberGuard } from './competition-member.guard';

describe('CompetitionMemberGuard', () => {
  const requireCompetitionMember = jest.fn();

  const competitionAccess = {
    requireCompetitionMember,
  } as unknown as CompetitionAccessService;

  const guard = new CompetitionMemberGuard(competitionAccess);

  const createContext = (
    userId?: string,
    competitionId?: string,
  ): {
    context: ExecutionContext;
    request: CompetitionRequest;
  } => {
    const request = {
      user: userId ? { id: userId } : undefined,
      params: competitionId ? { competitionId } : {},
    } as CompetitionRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return {
      context,
      request,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a member and attaches membership to the request', async () => {
    const membership: CompetitionMember = {
      id: 'membership-1',
      userId: 'user-1',
      competitionId: 'competition-1',
      role: MemberRole.PLAYER,
      joinedAt: new Date('2026-07-23T12:00:00.000Z'),
      lastSeenAt: new Date('2026-07-23T12:00:00.000Z'),
    };

    requireCompetitionMember.mockResolvedValue(membership);

    const { context, request } = createContext('user-1', 'competition-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(requireCompetitionMember).toHaveBeenCalledWith(
      'user-1',
      'competition-1',
    );

    expect(request.competitionMember).toEqual(membership);
  });

  it('throws UnauthorizedException when the user ID is missing', async () => {
    const { context } = createContext(undefined, 'competition-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(requireCompetitionMember).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when competition ID is missing', async () => {
    const { context } = createContext('user-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(requireCompetitionMember).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException', async () => {
    requireCompetitionMember.mockRejectedValue(
      new NotFoundException('Competition not found or user is not a member'),
    );

    const { context } = createContext('user-1', 'competition-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
