import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GameAccessService {
  constructor(private prisma: PrismaService) {}

  async requireGameMember(userId: string, gameId: string) {
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
      throw new NotFoundException('Game not found or user is not a member');
    }

    return membership;
  }

  async requireGameAdmin(userId: string, gameId: string) {
    const membership = await this.requireGameMember(userId, gameId);

    if (
      membership.role !== MemberRole.HOST &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException('User is not allowed to manage this game');
    }

    return membership;
  }
}

export default GameAccessService;
