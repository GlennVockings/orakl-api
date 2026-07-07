import { Module } from '@nestjs/common';
import { BetsModule } from './bets/bets.module';
import { FauxStakesLeaderboardModule } from './leaderboard/faux-stakes-leaderboard.module';
import { MarketsModule } from './markets/markets.module';
import { WsModule } from './realtime/ws.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    FauxStakesLeaderboardModule,
    TeamsModule,
    MarketsModule,
    BetsModule,
    WsModule,
  ],
  exports: [FauxStakesLeaderboardModule],
})
export class FauxStakesModule {}
