import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateTeamsDto } from './dto/create-team.dto';
import { WsGateway } from '../realtime/ws.gateway';
import { EditTeamsDto } from './dto/edit-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: WsGateway,
  ) {}

  async createTeams(competitionId: string, dto: CreateTeamsDto) {
    const game = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true },
    });

    if (!game) {
      throw new BadRequestException('Game does not exist');
    }

    const names = dto.names
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length === 0) {
      throw new BadRequestException('At least one valid team name is required');
    }

    // Check for duplicates in request itself
    const uniqueNames = new Set(names.map((name) => name.toLowerCase()));
    if (uniqueNames.size !== names.length) {
      throw new BadRequestException('Duplicate team names in request');
    }

    try {
      await this.prisma.team.createMany({
        data: names.map((name) => ({
          competitionId,
          name,
        })),
        skipDuplicates: true,
      });
    } catch {
      throw new BadRequestException('Failed to create teams');
    }

    this.wsGateway.emitTeamCreated(competitionId, {
      createdCount: names.length,
      names,
    });

    return this.prisma.team.findMany({
      where: { competitionId },
      orderBy: { name: 'asc' },
    });
  }

  async getTeams(competitionId: string) {
    const game = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, members: true },
    });

    if (!game) {
      throw new BadRequestException('Game does not exist');
    }

    return this.prisma.team.findMany({
      where: { competitionId },
      orderBy: { name: 'asc' },
    });
  }

  async editTeam(competitionId: string, dto: EditTeamsDto) {
    const team = await this.prisma.team.update({
      where: {
        competitionId,
        id: dto.teamId,
      },
      data: {
        name: dto.newName,
      },
    });

    return team;
  }
}
