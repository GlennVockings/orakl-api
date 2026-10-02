import { Module } from '@nestjs/common';
import { AuthModule } from 'src/platform/auth/auth.module';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { DatabaseModule } from 'src/platform/database/database.module';
import { WsModule } from '../realtime/ws.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, CompetitionsModule, WsModule, DatabaseModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
