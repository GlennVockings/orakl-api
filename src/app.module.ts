import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from './platform/auth/auth.module';
import { AppController } from './app.controller';
import { CompetitionsModule } from './games/faux-stakes/competitions/competitions.module';
import { LeaderboardModule } from './platform/leaderboard/leaderboard.module';
import { TeamsModule } from './games/faux-stakes/teams/teams.module';
import { MarketsModule } from './games/faux-stakes/markets/markets.module';
import { WsModule } from './games/faux-stakes/realtime/ws.module';
import { BetsModule } from './games/faux-stakes/bets/bets.module';

@Module({
  imports: [
    AuthModule,
    CompetitionsModule,
    LeaderboardModule,
    TeamsModule,
    MarketsModule,
    BetsModule,
    WsModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
