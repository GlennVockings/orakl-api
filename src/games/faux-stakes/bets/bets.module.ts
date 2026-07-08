import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { DatabaseModule } from 'src/platform/database/database.module';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';

@Module({
  imports: [DatabaseModule, CompetitionsModule],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
