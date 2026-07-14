import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class FauxStakesConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompetition(competitionId: string) {
    const config = await this.prisma.fauxStakesCompetition.findUnique({
      where: { competitionId },
    });

    if (!config) {
      throw new BadRequestException(
        'Faux Stakes competition config does not exist',
      );
    }

    return config;
  }
}
