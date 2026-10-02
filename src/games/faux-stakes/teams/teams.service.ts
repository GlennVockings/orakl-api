import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { WsGateway } from '../realtime/ws.gateway';
import { CreateTeamsDto } from './dto/create-team.dto';
import { EditTeamsDto } from './dto/edit-team.dto';

const MAX_TEAMS_PER_COMPETITION = 100;

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
    const names = dto.names.map((name) => name.trim());
    const normalizedNames = names.map(normalizeTeamName);

    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new BadRequestException('Duplicate team names in request');
    }

    try {
      const teams = await this.prisma.$transaction(async (tx) => {
        /*
         * Lock the competition row before checking the current team count.
         *
         * Every createTeams request for the same competition must acquire this
         * lock, so concurrent requests cannot both observe the same old count
         * and push the competition beyond the 100-team limit.
         */
        const lockedCompetition = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"
            FROM "Competition"
            WHERE "id" = ${competitionId}
            FOR UPDATE
          `,
        );

        if (lockedCompetition.length !== 1) {
          throw new BadRequestException('Competition does not exist');
        }

        const existingTeamCount = await tx.team.count({
          where: {
            competitionId,
          },
        });

        if (existingTeamCount + names.length > MAX_TEAMS_PER_COMPETITION) {
          throw new BadRequestException(
            `A competition can have at most ${MAX_TEAMS_PER_COMPETITION} teams`,
          );
        }

        await tx.team.createMany({
          data: names.map((name, index) => ({
            competitionId,
            name,
            normalizedName: normalizedNames[index],
          })),
        });

        return tx.team.findMany({
          where: {
            competitionId,
          },
          orderBy: {
            name: 'asc',
          },
        });
      });

      this.wsGateway.emitTeamCreated(competitionId, {
        createdCount: names.length,
        names,
      });

      return teams;
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
