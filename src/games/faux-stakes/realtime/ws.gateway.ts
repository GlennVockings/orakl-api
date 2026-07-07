import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://192.168.1.243:3000',
      'https://faux-stakes-web.vercel.app',
    ],
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_competition_room')
  handleJoinCompetitionRoom(
    @MessageBody() body: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`competition:${body.gameId}`);
    console.log(`Socket ${client.id} joined room competition:${body.gameId}`);
    return { ok: true };
  }

  emitMemberJoined(
    gameId: string,
    payload: { userId: string; displayName: string },
  ) {
    this.server.to(`competition:${gameId}`).emit('competition.member_joined', {
      gameId,
      ...payload,
    });
  }

  emitMarketCreated(gameId: string, payload: { name: string }) {
    this.server.to(`competition:${gameId}`).emit('faux-stakes.market_created', {
      gameId,
      ...payload,
    });
  }

  emitMarketSettled(
    gameId: string,
    payload: { id: string; name: string; winningSelectionId: string },
  ) {
    this.server.to(`competition:${gameId}`).emit('faux-stakes.market_settled', {
      gameId,
      ...payload,
    });
  }

  emitMarketClosed(gameId: string, payload: { id: string; name: string }) {
    this.server.to(`competition:${gameId}`).emit('faux-stakes.market_closed', {
      gameId,
      ...payload,
    });
  }

  emitTeamCreated(
    gameId: string,
    payload: { createdCount: number; names: string[] },
  ) {
    this.server.to(`competition:${gameId}`).emit('faux-stakes.team_created', {
      ...payload,
    });
  }
}
