import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { GameEngineRegistryService } from '../competition-registry/competition-engine-registry.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameEngineRegistry: GameEngineRegistryService,
  ) {}

  async getLeaderboard(userId: string, gameId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        id: gameId,
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
        'Game does not exist or user is not a member',
      );
    }

    const engine = this.gameEngineRegistry.get(game.gameType);

    return engine.getLeaderboard({
      competitionId: game.id,
    });
  }
}
