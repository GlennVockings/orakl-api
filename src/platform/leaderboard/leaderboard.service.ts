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
    const game = await this.prisma.competition.findFirst({
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

    if (!game) {
      throw new BadRequestException(
        'Competition does not exist or user is not a member',
      );
    }

    const engine = this.gameEngineRegistry.get(game.gameType);

    return engine.getLeaderboard({
      competitionId: game.id,
    });
  }
}
