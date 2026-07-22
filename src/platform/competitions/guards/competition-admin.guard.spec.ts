import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CompetitionAccessService } from '../competition-access.service';
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

  it('allows a competition administrator', async () => {
    requireCompetitionAdmin.mockResolvedValue({
      userId: 'user-1',
      competitionId: 'competition-1',
    });

    const result = await guard.canActivate(
      createContext('user-1', 'competition-1'),
    );

    expect(result).toBe(true);
    expect(requireCompetitionAdmin).toHaveBeenCalledWith(
      'user-1',
      'competition-1',
    );
  });

  it('throws UnauthorizedException when the user ID is missing', async () => {
    await expect(
      guard.canActivate(createContext(undefined, 'competition-1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(requireCompetitionAdmin).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the competition ID is missing', async () => {
    await expect(
      guard.canActivate(createContext('user-1')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(requireCompetitionAdmin).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenException from the access service', async () => {
    requireCompetitionAdmin.mockRejectedValue(
      new ForbiddenException('Competition admin access required'),
    );

    await expect(
      guard.canActivate(createContext('user-1', 'competition-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates NotFoundException from the access service', async () => {
    requireCompetitionAdmin.mockRejectedValue(
      new NotFoundException('Competition membership not found'),
    );

    await expect(
      guard.canActivate(createContext('user-1', 'competition-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
