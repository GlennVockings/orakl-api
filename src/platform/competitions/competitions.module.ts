import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { CompetitionAccessService } from './competition-access.service';
import { DatabaseModule } from '../database/database.module';
import { GameRegistryModule } from '../game-registry/game-registry.module';
import { CompetitionAdminGuard } from './guards/competition-admin.guard';
import { CompetitionMemberGuard } from './guards/competition-member.guard';

@Module({
  imports: [DatabaseModule, GameRegistryModule],
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    CompetitionAccessService,
    CompetitionMemberGuard,
    CompetitionAdminGuard,
  ],
  exports: [CompetitionsService, CompetitionAccessService],
})
export class CompetitionsModule {}
