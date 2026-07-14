/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { MemberRole } from '@prisma/client';
import { JoinCompetitionDto } from './dto/join-competition.dto';
import { GameEngineRegistryService } from '../game-registry/game-engine-registry.service';

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameEngineRegistry: GameEngineRegistryService,
  ) {}

  private generateJoinCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Removed: I, O, 0, 1 (to avoid confusion)

    let result = '';
    for (let i = 0; i < length; i++) {
      const rand = Math.floor(Math.random() * chars.length);
      result += chars[rand];
    }

    return result;
  }

  private async generateUniqueJoinCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = this.generateJoinCode(6);

      const exists = await this.prisma.competition.findUnique({
        where: { joinCode: code },
      });

      if (!exists) return code;
    }

    throw new Error('Failed to generate unique join code');
  }

  async createCompetition(userId: string, dto: CreateCompetitionDto) {
    for (let i = 0; i < 10; i++) {
      const joinCode = await this.generateUniqueJoinCode();
      const now = new Date();

      try {
        const competition = await this.prisma.$transaction(async (tx) => {
          const createdCompetition = await tx.competition.create({
            data: {
              name: dto.name,
              joinCode,
              createdById: userId,
              gameType: dto.gameType,
              status: 'DRAFT',
              lastActivityAt: now,
              members: {
                create: {
                  userId,
                  role: 'HOST',
                  lastSeenAt: now,
                },
              },
            },
            include: {
              members: true,
            },
          });
          return createdCompetition;
        });

        const engine = this.gameEngineRegistry.get(competition.gameType);

        await engine.onCompetitionCreated?.({
          competitionId: competition.id,
          hostUserId: userId,
          config: dto.config,
        });

        return competition;
      } catch (err: any) {
        if (err.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }

    throw new Error('Failed to generate unique join code');
  }

  async getAll(userId: string) {
    const competitions = await this.prisma.competition.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
        lastActivityAt: true,
        gameType: true,
        members: {
          where: { userId },
          select: {
            role: true,
            lastSeenAt: true,
          },
        },
      },
    });

    if (competitions.length === 0) return [];

    return Promise.all(
      competitions.map(async (competition) => {
        const myMembership = competition.members[0] ?? null;
        const lastSeenAt = myMembership?.lastSeenAt ?? competition.createdAt;
        const hasUpdates = competition.lastActivityAt > lastSeenAt;

        const engine = this.gameEngineRegistry.get(competition.gameType);
        const gameSummary = (await engine.getCompetitionSummary?.({
          userId,

          competitionId: competition.id,
        })) ?? {
          summary: {},

          membership: {},
        };

        return {
          id: competition.id,
          name: competition.name,
          status: competition.status,
          joinCode: competition.joinCode,
          lastActivityAt: competition.lastActivityAt,
          ...gameSummary.summary,

          myMembership: myMembership
            ? {
                role: myMembership.role,
                lastSeenAt: myMembership.lastSeenAt,
                hasUpdates,
                ...gameSummary.membership,
              }
            : null,
        };
      }),
    );
  }

  async joinCompetition(userId: string, dto: JoinCompetitionDto) {
    const joinCode = dto.joinCode.trim().toUpperCase();

    const competition = await this.prisma.competition.findFirst({
      where: { joinCode },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
        gameType: true,
      },
    });

    if (!competition)
      throw new BadRequestException('Join code is incorrect or does not exist');

    if (competition.status === 'CLOSED')
      throw new ForbiddenException('This competition is closed');

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.competitionMember.upsert({
        where: {
          competitionId_userId: { competitionId: competition.id, userId },
        },
        update: {
          lastSeenAt: now,
        },
        create: {
          competitionId: competition.id,
          userId,
          role: 'PLAYER',
          lastSeenAt: now,
        },
      });

      await tx.competition.update({
        where: { id: competition.id },
        data: { lastActivityAt: now },
      });

      return { competition, membership };
    });

    const engine = this.gameEngineRegistry.get(competition.gameType);

    await engine.onUserJoined?.({
      competitionId: competition.id,
      userId,
    });

    return result;
  }

  async markSeen(userId: string, competitionId: string) {
    const now = new Date();
    await this.prisma.competitionMember.update({
      where: { competitionId_userId: { competitionId, userId } },
      data: { lastSeenAt: now },
    });
    return { ok: true };
  }

  async getCompetition(userId: string, competitionId: string) {
    const competition = await this.prisma.competition.findFirst({
      where: { id: competitionId },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
      },
    });

    if (!competition)
      throw new BadRequestException('id is incorrect or does not exist');

    return competition;
  }

  async deleteCompetition(userId: string, competitionId: string) {
    const membership = await this.prisma.competitionMember.findUnique({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException(
        'Competition does not exist or user is not a member',
      );
    }

    if (
      membership.role !== MemberRole.HOST &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'User is not allowed to delete this competition',
      );
    }

    await this.prisma.competition.delete({
      where: { id: competitionId },
    });

    return {
      ok: true,
      deletedCompetitionId: competitionId,
      deletedCompetitionName: membership.competition.name,
    };
  }

  async getMe(userId: string, competitionId: string) {
    const membership = await this.prisma.competitionMember.findUnique({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      include: {
        competition: {
          select: {
            id: true,
            createdAt: true,
            lastActivityAt: true,
            gameType: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException(
        'Competition does not exist or user is not a member',
      );
    }

    const engine = this.gameEngineRegistry.get(membership.competition.gameType);
    const playerState =
      (await engine.getPlayerState?.({
        userId,
        competitionId: membership.competition.id,
      })) ?? {};

    return {
      userId,
      role: membership.role,
      isAdmin: membership.role === 'ADMIN' || membership.role === 'HOST',
      ...playerState,
      lastSeenAt: membership.lastSeenAt,
      hasUpdates: membership.competition.lastActivityAt > membership.lastSeenAt,
    };
  }
}
