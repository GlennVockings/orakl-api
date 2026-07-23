import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GameType, MemberRole } from '@prisma/client';
import { CompetitionAccessService } from './competition-access.service';
import { PrismaService } from '../../prisma.service';

describe('CompetitionAccessService', () => {
  const findUnique = jest.fn();

  const prisma = {
    competitionMember: {
      findUnique,
    },
  } as unknown as PrismaService;

  const service = new CompetitionAccessService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireCompetitionMember', () => {
    it('returns the membership when the user is a member', async () => {
      const membership = {
        userId: 'user-1',
        competitionId: 'competition-1',
        role: MemberRole.PLAYER,
      };

      findUnique.mockResolvedValue(membership);

      await expect(
        service.requireCompetitionMember('user-1', 'competition-1'),
      ).resolves.toEqual(membership);
    });

    it('throws NotFoundException when the user is not a member', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.requireCompetitionMember('user-1', 'competition-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireGameCompetition', () => {
    it('returns membership for the expected game type', async () => {
      const membership = {
        userId: 'user-1',
        competitionId: 'competition-1',
        role: MemberRole.PLAYER,
        competition: {
          gameType: GameType.FAUX_STAKES,
        },
      };

      findUnique.mockResolvedValue(membership);

      await expect(
        service.requireGameCompetition(
          'user-1',
          'competition-1',
          GameType.FAUX_STAKES,
        ),
      ).resolves.toEqual(membership);
    });

    it('throws NotFoundException when the game type is incorrect', async () => {
      findUnique.mockResolvedValue({
        userId: 'user-1',
        competitionId: 'competition-1',
        role: MemberRole.PLAYER,
        competition: {
          gameType: GameType.PREDICTOR,
        },
      });

      await expect(
        service.requireGameCompetition(
          'user-1',
          'competition-1',
          GameType.FAUX_STAKES,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when membership does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.requireGameCompetition(
          'user-1',
          'competition-1',
          GameType.FAUX_STAKES,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireCompetitionAdmin', () => {
    it.each([MemberRole.HOST, MemberRole.ADMIN])(
      'allows a user with the %s role',
      async (role) => {
        const membership = {
          userId: 'user-1',
          competitionId: 'competition-1',
          role,
        };

        findUnique.mockResolvedValue(membership);

        await expect(
          service.requireCompetitionAdmin('user-1', 'competition-1'),
        ).resolves.toEqual(membership);
      },
    );

    it('throws ForbiddenException for an ordinary member', async () => {
      findUnique.mockResolvedValue({
        userId: 'user-1',
        competitionId: 'competition-1',
        role: MemberRole.PLAYER,
      });

      await expect(
        service.requireCompetitionAdmin('user-1', 'competition-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when membership does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.requireCompetitionAdmin('user-1', 'competition-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates the game type when admin access includes one', async () => {
      findUnique.mockResolvedValue({
        userId: 'user-1',
        competitionId: 'competition-1',
        role: MemberRole.HOST,
        competition: {
          gameType: GameType.PREDICTOR,
        },
      });

      await expect(
        service.requireCompetitionAdmin(
          'user-1',
          'competition-1',
          GameType.FAUX_STAKES,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
