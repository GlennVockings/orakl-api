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
    origin: ['http://localhost:3000', 'http://192.168.1.243:3000'],
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
  async handleJoinCompetitionRoom(
    @MessageBody() body: { competitionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(`competition:${body.competitionId}`);
    console.log(
      `Socket ${client.id} joined room competition:${body.competitionId}`,
    );
    return { ok: true };
  }

  emitMemberJoined(
    competitionId: string,
    payload: { userId: string; displayName: string },
  ) {
    this.server
      .to(`competition:${competitionId}`)
      .emit('competition.member_joined', {
        competitionId,
        ...payload,
      });
  }

  emitMarketCreated(competitionId: string, payload: { name: string }) {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_created', {
        competitionId,
        ...payload,
      });
  }

  emitMarketSettled(
    competitionId: string,
    payload: { id: string; name: string; winningSelectionId: string },
  ) {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_settled', {
        competitionId,
        ...payload,
      });
  }

  emitMarketClosed(
    competitionId: string,
    payload: { id: string; name: string },
  ) {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.market_closed', {
        competitionId,
        ...payload,
      });
  }

  emitTeamCreated(
    competitionId: string,
    payload: { createdCount: number; names: string[] },
  ) {
    this.server
      .to(`competition:${competitionId}`)
      .emit('faux-stakes.team_created', {
        ...payload,
      });
  }
}
