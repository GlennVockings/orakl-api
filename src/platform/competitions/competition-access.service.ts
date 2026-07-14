import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

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

  async requireCompetitionAdmin(userId: string, competitionId: string) {
    const membership = await this.requireCompetitionMember(
      userId,
      competitionId,
    );

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
}

export default CompetitionAccessService;
