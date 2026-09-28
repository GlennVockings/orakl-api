import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { WsGateway } from '../realtime/ws.gateway';
import { CreateTeamsDto } from './dto/create-team.dto';
import { EditTeamsDto } from './dto/edit-team.dto';

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: WsGateway,
  ) {}

  async createTeams(competitionId: string, dto: CreateTeamsDto) {
    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },

      select: {
        id: true,
      },
    });

    if (!competition) {
      throw new BadRequestException('Competition does not exist');
    }

    const names = dto.names.map((name) => name.trim());

    const normalizedNames = names.map(normalizeTeamName);

    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new BadRequestException('Duplicate team names in request');
    }

    try {
      await this.prisma.team.createMany({
        data: names.map((name, index) => ({
          competitionId,
          name,
          normalizedName: normalizedNames[index],
        })),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'One or more teams already exist in this competition',
        );
      }

      throw error;
    }

    this.wsGateway.emitTeamCreated(competitionId, {
      createdCount: names.length,
      names,
    });

    return this.prisma.team.findMany({
      where: {
        competitionId,
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  async getTeams(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: {
        id: competitionId,
      },

      select: {
        id: true,
      },
    });

    if (!competition) {
      throw new BadRequestException('Competition does not exist');
    }

    return this.prisma.team.findMany({
      where: {
        competitionId,
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  async editTeam(competitionId: string, dto: EditTeamsDto) {
    const name = dto.newName.trim();

    if (!name) {
      throw new BadRequestException('Team name cannot be empty');
    }

    try {
      const updated = await this.prisma.team.updateMany({
        where: {
          id: dto.teamId,
          competitionId,
        },

        data: {
          name,
          normalizedName: normalizeTeamName(name),
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'Team does not exist for this competition',
        );
      }

      return this.prisma.team.findUnique({
        where: {
          id: dto.teamId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('A team with this name already exists');
      }

      throw error;
    }
  }
}
