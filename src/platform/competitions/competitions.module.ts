import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { CompetitionAccessService } from './competition-access.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { CompetitionAdminGuard } from './guards/competition-admin.guard';
import { CompetitionMemberGuard } from './guards/competition-member.guard';
import { FauxStakesAdminGuard } from './guards/faux-stakes-admin.guard';
import { FauxStakesMemberGuard } from './guards/faux-stakes-member.guard';

@Module({
  imports: [DatabaseModule, GameRegistryModule],

  controllers: [CompetitionsController],

  providers: [
    CompetitionsService,
    CompetitionAccessService,
    CompetitionMemberGuard,
    CompetitionAdminGuard,
    FauxStakesMemberGuard,
    FauxStakesAdminGuard,
  ],

  exports: [
    CompetitionsService,
    CompetitionAccessService,
    CompetitionMemberGuard,
    CompetitionAdminGuard,
    FauxStakesMemberGuard,
    FauxStakesAdminGuard,
  ],
})
export class CompetitionsModule {}
