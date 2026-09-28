import { Module } from '@nestjs/common';
import { AuthModule } from '../../../platform/auth/auth.module';
import { CompetitionsModule } from '../../../platform/competitions/competitions.module';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [AuthModule, CompetitionsModule],

  providers: [WsGateway],

  exports: [WsGateway],
})
export class WsModule {}
