import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CompetitionMember } from '@prisma/client';
import { MemberRole } from '@prisma/client';
import { CompetitionAccessService } from '../competition-access.service';
import type { CompetitionRequest } from '../types/authenticated-request';
import { CompetitionAdminGuard } from './competition-admin.guard';

describe('CompetitionAdminGuard', () => {
  const requireCompetitionAdmin = jest.fn();

  const competitionAccess = {
    requireCompetitionAdmin,
  } as unknown as CompetitionAccessService;

  const guard = new CompetitionAdminGuard(competitionAccess);

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

  it('allows an admin and attaches membership to the request', async () => {
    const membership: CompetitionMember = {
      id: 'membership-1',
      userId: 'user-1',
      competitionId: 'competition-1',
      role: MemberRole.ADMIN,
      joinedAt: new Date('2026-07-23T12:00:00.000Z'),
      lastSeenAt: new Date('2026-07-23T12:00:00.000Z'),
    };

    requireCompetitionAdmin.mockResolvedValue(membership);

    const { context, request } = createContext('user-1', 'competition-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(requireCompetitionAdmin).toHaveBeenCalledWith(
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

    expect(requireCompetitionAdmin).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when competition ID is missing', async () => {
    const { context } = createContext('user-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(requireCompetitionAdmin).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenException', async () => {
    requireCompetitionAdmin.mockRejectedValue(
      new ForbiddenException('User is not allowed to manage this competition'),
    );

    const { context } = createContext('user-1', 'competition-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('propagates NotFoundException', async () => {
    requireCompetitionAdmin.mockRejectedValue(
      new NotFoundException('Competition not found or user is not a member'),
    );

    const { context } = createContext('user-1', 'competition-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
