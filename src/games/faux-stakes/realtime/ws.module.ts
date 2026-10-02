import { Module } from '@nestjs/common';
import { AuthModule } from '../../../platform/auth/auth.module';
import { CompetitionAccessModule } from '../../../platform/competitions/competition-access.module';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [AuthModule, CompetitionAccessModule],

  providers: [WsGateway],

  exports: [WsGateway],
})
export class WsModule {}
