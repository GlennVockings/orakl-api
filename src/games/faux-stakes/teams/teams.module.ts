import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { CompetitionsModule } from '../competitions/competitions.module';
import { WsModule } from '../realtime/ws.module';

@Module({
  imports: [CompetitionsModule, WsModule],
  controllers: [TeamsController],
  providers: [TeamsService, PrismaService],
  exports: [TeamsService],
})
export class TeamsModule {}
