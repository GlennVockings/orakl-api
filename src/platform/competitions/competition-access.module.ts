import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CompetitionAccessService } from './competition-access.service';

@Module({
  imports: [DatabaseModule],
  providers: [CompetitionAccessService],
  exports: [CompetitionAccessService],
})
export class CompetitionAccessModule {}
