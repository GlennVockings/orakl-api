import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { PrismaService } from 'src/prisma.service';
import { CompetitionAccessService } from './competition-access.service';
import { WsGateway } from 'src/games/faux-stakes/realtime/ws.gateway';

@Module({
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    PrismaService,
    CompetitionAccessService,
    WsGateway,
  ],
  exports: [CompetitionAccessService],
})
export class CompetitionsModule {}
