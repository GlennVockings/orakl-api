import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { CompetitionAccessService } from './competition-access.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CompetitionAccessService],
  exports: [CompetitionsService, CompetitionAccessService],
})
export class CompetitionsModule {}
