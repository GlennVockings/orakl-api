import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { WsModule } from '../realtime/ws.module';
import { DatabaseModule } from 'src/platform/database/database.module';

@Module({
  imports: [CompetitionsModule, WsModule, DatabaseModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
