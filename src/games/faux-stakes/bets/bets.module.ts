import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { DatabaseModule } from 'src/platform/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BetsController],
  providers: [BetsService, CompetitionAccessService],
  exports: [BetsService],
})
export class BetsModule {}
