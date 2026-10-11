import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from 'src/prisma.service';
import { GameEngineRegistryService } from '../game-registry/game-engine-registry.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { JoinCompetitionDto } from './dto/join-competition.dto';

function isJoinCodeUniqueConstraintError(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;

  if (typeof target === 'string') {
    return target.includes('joinCode');
  }

  if (Array.isArray(target)) {
    return target.some(
      (field) => typeof field === 'string' && field === 'joinCode',
    );
  }

  return false;
}

@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameEngineRegistry: GameEngineRegistryService,
  ) {}

  private generateJoinCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars[randomInt(chars.length)];
    }

    return result;
  }

  async createCompetition(userId: string, dto: CreateCompetitionDto) {
    const engine = this.gameEngineRegistry.get(dto.gameType);

    if (!engine.isEnabled()) {
      throw new BadRequestException('This game type is currently unavailable');
    }

    /*
     * Validate game-specific configuration BEFORE we write anything.
     *
     * The platform remains game-agnostic: each engine owns its own
     * configuration contract.
     */
    engine.validateCompetitionConfig?.(dto.config);

    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Competition name is required');
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const joinCode = this.generateJoinCode();
      const now = new Date();

      try {
        return await this.prisma.$transaction(async (tx) => {
          const competition = await tx.competition.create({
            data: {
              name,
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

          /*
           * Game initialization participates in this SAME transaction.
           *
           * Faux Stakes config, starting balance and initial teams
           * therefore cannot fail independently from Competition
           * creation.
           */
          await engine.onCompetitionCreated?.({
            competitionId: competition.id,
            hostUserId: userId,
            config: dto.config,
            tx,
          });

          return competition;
        });
      } catch (error) {
        /*
         * joinCode has a DB unique constraint, which is the final
         * authority.
         *
         * Only a collision on THAT constraint should generate another
         * code and retry the transaction. Any other P2002 is a genuine
         * data/invariant problem and must surface normally.
         */
        if (isJoinCodeUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Failed to generate a unique join code');
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
      orderBy: {
        lastActivityAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
        lastActivityAt: true,
        gameType: true,
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
            lastSeenAt: true,
          },
        },
      },
    });

    if (competitions.length === 0) {
      return [];
    }

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

        const canInvite =
          myMembership?.role === MemberRole.HOST ||
          myMembership?.role === MemberRole.ADMIN;

        return {
          id: competition.id,
          name: competition.name,
          status: competition.status,
          joinCode: canInvite ? competition.joinCode : undefined,
          gameType: competition.gameType,
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
      where: {
        joinCode,
      },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
        gameType: true,
      },
    });

    if (!competition) {
      throw new BadRequestException('Join code is incorrect or does not exist');
    }

    if (competition.status === 'CLOSED') {
      throw new ForbiddenException('This competition is closed');
    }

    const engine = this.gameEngineRegistry.get(competition.gameType);

    if (!engine.isEnabled()) {
      throw new BadRequestException('This game type is currently unavailable');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      /*
       * This upsert is also our concurrency boundary.
       *
       * CompetitionMember has a unique constraint on
       * competitionId/userId. Concurrent joins for the same player
       * therefore serialize around this row before the engine
       * initializes the wallet.
       */
      const membership = await tx.competitionMember.upsert({
        where: {
          competitionId_userId: {
            competitionId: competition.id,
            userId,
          },
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

      await engine.onUserJoined?.({
        competitionId: competition.id,
        userId,
        tx,
      });

      await tx.competition.update({
        where: {
          id: competition.id,
        },
        data: {
          lastActivityAt: now,
        },
      });

      return {
        competition,
        membership,
      };
    });

    /*
     * Realtime is a post-commit side effect.
     *
     * A failed database transaction must never emit a successful
     * "member joined" event.
     */
    try {
      await engine.afterUserJoined?.({
        competitionId: competition.id,
        userId,
      });
    } catch (error) {
      this.logger.error(
        `Competition join committed but post-join side effect failed for competition ${competition.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return result;
  }

  async markSeen(userId: string, competitionId: string) {
    const now = new Date();

    await this.prisma.competitionMember.update({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      data: {
        lastSeenAt: now,
      },
    });

    return {
      ok: true,
    };
  }

  async getCompetition(userId: string, competitionId: string) {
    const competition = await this.prisma.competition.findFirst({
      where: {
        id: competitionId,
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        createdAt: true,
        gameType: true,
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!competition) {
      throw new NotFoundException(
        'Competition not found or user is not a member',
      );
    }

    const membership = competition.members[0];

    const canInvite =
      membership?.role === MemberRole.HOST ||
      membership?.role === MemberRole.ADMIN;

    return {
      id: competition.id,
      name: competition.name,
      status: competition.status,
      joinCode: canInvite ? competition.joinCode : undefined,
      createdAt: competition.createdAt,
      gameType: competition.gameType,
    };
  }

  async getMembers(competitionId: string) {
    return this.prisma.competitionMember.findMany({
      where: {
        competitionId,
      },
      orderBy: [
        {
          joinedAt: 'asc',
        },
      ],
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });
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
      where: {
        id: competitionId,
      },
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
      isAdmin:
        membership.role === MemberRole.ADMIN ||
        membership.role === MemberRole.HOST,
      ...playerState,
      lastSeenAt: membership.lastSeenAt,
      hasUpdates: membership.competition.lastActivityAt > membership.lastSeenAt,
    };
  }
}
