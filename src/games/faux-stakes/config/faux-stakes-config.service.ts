import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class FauxStakesConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompetition(gameId: string) {
    const config = await this.prisma.fauxStakesCompetition.findUnique({
      where: { gameId },
    });

    if (config) return config;

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        startingChips: true,
      },
    });

    if (!game) {
      throw new BadRequestException('Faux Stakes competition does not exist');
    }

    return this.prisma.fauxStakesCompetition.create({
      data: {
        gameId: game.id,
        startingChips: game.startingChips,
      },
    });
  }
}
