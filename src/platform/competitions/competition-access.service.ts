import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameType, MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CompetitionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireCompetitionMember(userId: string, competitionId: string) {
    const membership = await this.prisma.competitionMember.findUnique({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        'Competition not found or user is not a member',
      );
    }

    return membership;
  }

  async requireCompetitionAdmin(
    userId: string,
    competitionId: string,
    expectedGameType?: GameType,
  ) {
    const membership = expectedGameType
      ? await this.requireGameCompetition(
          userId,
          competitionId,
          expectedGameType,
        )
      : await this.requireCompetitionMember(userId, competitionId);

    if (
      membership.role !== MemberRole.HOST &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'User is not allowed to manage this competition',
      );
    }

    return membership;
  }

  async requireGameCompetition(
    userId: string,
    competitionId: string,
    expectedGameType: GameType,
  ) {
    const membership = await this.prisma.competitionMember.findUnique({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      include: {
        competition: {
          select: {
            gameType: true,
          },
        },
      },
    });

    if (!membership || membership.competition.gameType !== expectedGameType) {
      throw new NotFoundException(
        'Competition not found or unavailable for this game',
      );
    }

    return membership;
  }
}

export default CompetitionAccessService;
