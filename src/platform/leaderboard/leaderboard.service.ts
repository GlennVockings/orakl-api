import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { GameEngineRegistryService } from '../game-registry/game-engine-registry.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameEngineRegistry: GameEngineRegistryService,
  ) {}

  async getLeaderboard(userId: string, competitionId: string) {
    const competition = await this.prisma.competition.findFirst({
      where: {
        id: competitionId,
        members: {
          some: { userId },
        },
      },
      select: {
        id: true,
        gameType: true,
      },
    });

    if (!competition) {
      throw new BadRequestException(
        'Competition does not exist or user is not a member',
      );
    }

    const engine = this.gameEngineRegistry.get(competition.gameType);

    return engine.getLeaderboard({
      competitionId: competition.id,
    });
  }
}
