import { Logger, UnauthorizedException } from '@nestjs/common';
import { GameType } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtVerifierService } from '../../../platform/auth/jwt-verifier.service';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';

type AuthenticatedSocketData = {
  userId?: string;
};

type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  AuthenticatedSocketData
>;

type SocketAuth = {
  token?: unknown;
};

function getTrustedOrigins(): string[] {
  return (process.env.AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getSocketToken(socket: Socket): string | null {
  const auth: unknown = socket.handshake.auth;

  if (typeof auth === 'object' && auth !== null) {
    const socketAuth = auth as SocketAuth;

    if (typeof socketAuth.token === 'string' && socketAuth.token.length > 0) {
      return socketAuth.token;
    }
  }

  const authorization = socket.handshake.headers.authorization;

  if (typeof authorization !== 'string') {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

@WebSocketGateway({
  cors: {
    origin: getTrustedOrigins(),
    credentials: true,
  },
})
export class WsGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtVerifier: JwtVerifierService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket: AuthenticatedSocket, next): void => {
      const token = getSocketToken(socket);

      if (!token) {
        next(new Error('Authentication required'));

        return;
      }

      void this.authenticateSocket(socket, token, next);
    });
  }

  private async authenticateSocket(
    socket: AuthenticatedSocket,
    token: string,
    next: (error?: Error) => void,
  ): Promise<void> {
    try {
      const user = await this.jwtVerifier.verify(token);

      socket.data.userId = user.id;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        next(new Error('Authentication failed'));

        return;
      }

      this.logger.error(
        'Unexpected WebSocket authentication failure',
        error instanceof Error ? error.stack : undefined,
      );

      next(new Error('Authentication failed'));
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_competition_room')
  async handleJoinCompetitionRoom(
    @MessageBody()
    body: {
      competitionId?: unknown;
    },
    @ConnectedSocket()
    client: AuthenticatedSocket,
  ) {
    const userId = client.data.userId;

    if (!userId) {
      throw new WsException('Authentication required');
    }

    if (
      typeof body.competitionId !== 'string' ||
      body.competitionId.length === 0
    ) {
      throw new WsException('A competitionId is required');
    }

    try {
      await this.competitionAccess.requireGameCompetition(
        userId,
        body.competitionId,
        GameType.FAUX_STAKES,
      );
    } catch {
      /*
       * Deliberately avoid revealing whether the
       * requested competition exists.
       */
      throw new WsException('Competition is unavailable');
    }

    await client.join(`competition:${body.competitionId}`);

    return {
      ok: true,
    };
  }

  emitMemberJoined(
    competitionId: string,
    payload: {
      userId: string;
      displayName: string;
    },
  ): void {
    this.server
      .to(`competition:${competitionId}`)
      .emit('competition.member_joined', {
        competitionId,
        ...payload,
      });
  }

  emitMarketCreated(
    competitionId: string,
    payload: {
      name: string;
    },
  ): void {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_created', {
        competitionId,
        ...payload,
      });
  }

  emitMarketSettled(
    competitionId: string,
    payload: {
      id: string;
      name: string;
      winningSelectionId: string;
    },
  ): void {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_settled', {
        competitionId,
        ...payload,
      });
  }

  emitMarketClosed(
    competitionId: string,
    payload: {
      id: string;
      name: string;
    },
  ): void {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_closed', {
        competitionId,
        ...payload,
      });
  }

  emitTeamCreated(
    competitionId: string,
    payload: {
      createdCount: number;
      names: string[];
    },
  ): void {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.team_created', {
        competitionId,
        ...payload,
      });
  }
}
