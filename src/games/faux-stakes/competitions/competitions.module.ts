import { Module } from '@nestjs/common';
import { GamesController } from './competitions.controller';
import { GamesService } from './competitions.service';
import { PrismaService } from 'src/prisma.service';
import { GameAccessService } from './competitions-access.service';
import { WsGateway } from '../realtime/ws.gateway';

@Module({
  controllers: [GamesController],
  providers: [GamesService, PrismaService, GameAccessService, WsGateway],
  exports: [GameAccessService],
})
export class GamesModule {}
