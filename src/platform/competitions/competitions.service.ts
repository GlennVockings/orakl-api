/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { LedgerType, MemberRole, Prisma } from '@prisma/client';
import { JoinCompetitionDto } from './dto/join-competition.dto';
import { WsGateway } from 'src/games/faux-stakes/realtime/ws.gateway';

function txnSign(type: LedgerType) {
  // CREDIT/PAYOUT/REFUND add, DEBIT subtract
  switch (type) {
    case 'DEBIT':
      return -1;
    case 'CREDIT':
    case 'PAYOUT':
    case 'REFUND':
    default:
      return 1;
  }
}

@Injectable()
export class CompetitionsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WsGateway,
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

      const exists = await this.prisma.game.findUnique({
        where: { joinCode: code },
      });

      if (!exists) return code;
    }

    throw new Error('Failed to generate unique join code');
  }

  async createCompetition(userId: string, dto: CreateCompetitionDto) {
    for (let i = 0; i < 10; i++) {
      const joinCode = await this.generateUniqueJoinCode();
      const startingChips = dto.startingChips ?? 1000;
      const now = new Date();

      const teamNames = (dto.teamNames ?? [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const uniqueNames = Array.from(
        new Map(teamNames.map((name) => [name.toLowerCase(), name])).values(),
      );

      try {
        const game = await this.prisma.$transaction(async (tx) => {
          const createdCompetition = await tx.game.create({
            data: {
              name: dto.name,
              joinCode,
              startingChips,
              createdById: userId,
              status: 'DRAFT',
              lastActivityAt: now,
              members: {
                create: {
                  userId,
                  role: 'HOST',
                  lastSeenAt: now,
                },
              },
              teams: uniqueNames.length
                ? {
                    create: uniqueNames.map((name) => ({
                      name,
                    })),
                  }
                : undefined,
            },
            include: {
              members: true,
              teams: true,
            },
          });

          await tx.gameLedgerTxn.create({
            data: {
              gameId: createdCompetition.id,
              userId,
              type: 'CREDIT',
              amount: startingChips,
            },
          });

          return createdCompetition;
        });

        return game;
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
    const games = await this.prisma.game.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    if (games.length === 0) return [];

    const gameIds = games.map((g) => g.id);

    const txns = await this.prisma.gameLedgerTxn.findMany({
      where: { gameId: { in: gameIds } },
      select: { gameId: true, userId: true, type: true, amount: true },
    });

    const balanceByCompetitionUser = new Map<string, Map<string, number>>();

    for (const t of txns) {
      const sign = txnSign(t.type);
      const amt = Number(t.amount) * sign;

      let byUser = balanceByCompetitionUser.get(t.gameId);
      if (!byUser) {
        byUser = new Map<string, number>();
        balanceByCompetitionUser.set(t.gameId, byUser);
      }
      byUser.set(t.userId, (byUser.get(t.userId) ?? 0) + amt);
    }

    return games.map((g) => {
      const myMembership = g.members.find((m) => m.userId === userId);
      const byUser = balanceByCompetitionUser.get(g.id) ?? new Map();

      const myBalance = byUser.get(userId) ?? g.startingChips;

      const leaderboard = g.members
        .map((m) => ({
          userId: m.userId,
          displayName: m.user.displayName,
          balance: byUser.get(m.userId) ?? g.startingChips,
        }))
        .sort((a, b) => b.balance - a.balance);

      const lastSeenAt = myMembership?.lastSeenAt ?? g.createdAt;
      const hasUpdates = g.lastActivityAt > lastSeenAt;

      return {
        id: g.id,
        name: g.name,
        status: g.status,
        joinCode: g.joinCode,
        startingChips: g.startingChips,
        lastActivityAt: g.lastActivityAt,

        myMembership: myMembership
          ? {
              role: myMembership.role,
              lastSeenAt: myMembership.lastSeenAt,
              balance: myBalance,
              hasUpdates,
            }
          : null,

        leaderboard,
      };
    });
  }

  async joinCompetition(userId: string, dto: JoinCompetitionDto) {
    const joinCode = dto.joinCode.trim().toUpperCase();

    const game = await this.prisma.game.findFirst({
      where: { joinCode },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        startingChips: true,
        createdAt: true,
      },
    });

    if (!game)
      throw new BadRequestException('Join code is incorrect or does not exist');

    if (game.status === 'CLOSED')
      throw new ForbiddenException('This game is closed');

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.gameMember.upsert({
        where: { gameId_userId: { gameId: game.id, userId } },
        update: {
          lastSeenAt: now,
        },
        create: {
          gameId: game.id,
          userId,
          role: 'PLAYER',
          lastSeenAt: now,
        },
      });

      const hasAnyTxn = await tx.gameLedgerTxn.findFirst({
        where: { gameId: game.id, userId },
        select: { id: true },
      });

      if (!hasAnyTxn) {
        await tx.gameLedgerTxn.create({
          data: {
            gameId: game.id,
            userId,
            type: 'CREDIT',
            amount: new Prisma.Decimal(game.startingChips),
          },
        });
      }

      await tx.game.update({
        where: { id: game.id },
        data: { lastActivityAt: now },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true },
      });

      return { game, membership, user };
    });

    if (result.user) {
      this.wsGateway.emitMemberJoined(game.id, {
        userId: result.user.id,
        displayName: result.user.displayName,
      });
    }

    return result;
  }

  async markSeen(userId: string, gameId: string) {
    const now = new Date();
    await this.prisma.gameMember.update({
      where: { gameId_userId: { gameId, userId } },
      data: { lastSeenAt: now },
    });
    return { ok: true };
  }

  async getCompetition(userId: string, gameId: string) {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        status: true,
        joinCode: true,
        startingChips: true,
        createdAt: true,
      },
    });

    if (!game)
      throw new BadRequestException('id is incorrect or does not exist');

    return game;
  }

  async deleteCompetition(userId: string, gameId: string) {
    const membership = await this.prisma.gameMember.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      include: {
        game: {
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
      throw new ForbiddenException('User is not allowed to delete this game');
    }

    await this.prisma.game.delete({
      where: { id: gameId },
    });

    return {
      ok: true,
      deletedCompetitionId: gameId,
      deletedCompetitionName: membership.game.name,
    };
  }

  async getMe(userId: string, gameId: string) {
    const membership = await this.prisma.gameMember.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      include: {
        game: {
          select: {
            id: true,
            createdAt: true,
            lastActivityAt: true,
            startingChips: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException(
        'Competition does not exist or user is not a member',
      );
    }

    const txns = await this.prisma.gameLedgerTxn.findMany({
      where: {
        gameId,
        userId,
      },
      select: {
        type: true,
        amount: true,
        marketId: true,
      },
    });

    const currentBalance = txns.reduce((sum, txn) => {
      const sign = txn.type === 'DEBIT' ? -1 : 1;

      return sum + Number(txn.amount) * sign;
    }, 0);

    const settledMarkets = await this.prisma.market.findMany({
      where: {
        gameId,
        status: 'SETTLED',
      },
      select: {
        id: true,
      },
    });

    const settledMarketIds = new Set(settledMarkets.map((m) => m.id));

    const settledBalance = txns.reduce((sum, txn) => {
      const shouldInclude = !txn.marketId || settledMarketIds.has(txn.marketId);
      if (!shouldInclude) return sum;

      const sign = txn.type === 'DEBIT' ? -1 : 1;

      return sum + Number(txn.amount) * sign;
    }, 0);

    return {
      userId,
      role: membership.role,
      isAdmin: membership.role === 'ADMIN' || membership.role === 'HOST',
      currentBalance,
      settledBalance,
      lastSeenAt: membership.lastSeenAt,
      hasUpdates: membership.game.lastActivityAt > membership.lastSeenAt,
    };
  }
}
