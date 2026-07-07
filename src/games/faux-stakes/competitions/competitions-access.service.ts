import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CompetitionAccessService {
  constructor(private prisma: PrismaService) {}

  async requireCompetitionMember(userId: string, gameId: string) {
    const membership = await this.prisma.gameMember.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      include: {
        game: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(
        'Competition not found or user is not a member',
      );
    }

    return membership;
  }

  async requireCompetitionAdmin(userId: string, gameId: string) {
    const membership = await this.requireCompetitionMember(userId, gameId);

    if (
      membership.role !== MemberRole.HOST &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException('User is not allowed to manage this game');
    }

    return membership;
  }
}

export default CompetitionAccessService;
