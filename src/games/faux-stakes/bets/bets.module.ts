import { Module } from '@nestjs/common';
import { AuthModule } from 'src/platform/auth/auth.module';
import { CompetitionsModule } from 'src/platform/competitions/competitions.module';
import { DatabaseModule } from 'src/platform/database/database.module';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';

@Module({
  imports: [AuthModule, DatabaseModule, CompetitionsModule],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
