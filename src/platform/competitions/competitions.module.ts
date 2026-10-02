import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { CompetitionAccessModule } from './competition-access.module';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { CompetitionAdminGuard } from './guards/competition-admin.guard';
import { AuthenticatedUserThrottlerGuard } from './guards/authenticated-user-throttler.guard';
import { CompetitionJoinThrottlerGuard } from './guards/competition-join-throttler.guard';
import { CompetitionMemberGuard } from './guards/competition-member.guard';
import { FauxStakesAdminGuard } from './guards/faux-stakes-admin.guard';
import { FauxStakesMemberGuard } from './guards/faux-stakes-member.guard';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    GameRegistryModule,
    CompetitionAccessModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],

  controllers: [CompetitionsController],

  providers: [
    CompetitionsService,
    CompetitionMemberGuard,
    CompetitionAdminGuard,
    CompetitionJoinThrottlerGuard,
    AuthenticatedUserThrottlerGuard,
    FauxStakesMemberGuard,
    FauxStakesAdminGuard,
  ],

  exports: [
    CompetitionsService,
    CompetitionAccessModule,
    CompetitionMemberGuard,
    CompetitionAdminGuard,
    AuthenticatedUserThrottlerGuard,
    FauxStakesMemberGuard,
    FauxStakesAdminGuard,
  ],
})
export class CompetitionsModule {}
