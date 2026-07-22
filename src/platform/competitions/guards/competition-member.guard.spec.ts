import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CompetitionAccessService } from '../competition-access.service';
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
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
          params: competitionId ? { competitionId } : {},
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an authenticated competition member', async () => {
    requireCompetitionMember.mockResolvedValue({
      userId: 'user-1',
      competitionId: 'competition-1',
    });

    const result = await guard.canActivate(
      createContext('user-1', 'competition-1'),
    );

    expect(result).toBe(true);
    expect(requireCompetitionMember).toHaveBeenCalledWith(
      'user-1',
      'competition-1',
    );
  });

  it('throws UnauthorizedException when the user ID is missing', async () => {
    await expect(
      guard.canActivate(createContext(undefined, 'competition-1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(requireCompetitionMember).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the competition ID is missing', async () => {
    await expect(
      guard.canActivate(createContext('user-1')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(requireCompetitionMember).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from the access service', async () => {
    requireCompetitionMember.mockRejectedValue(
      new NotFoundException('Competition membership not found'),
    );

    await expect(
      guard.canActivate(createContext('user-1', 'competition-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
