import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { PrismaService } from 'src/prisma.service';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';

@Module({
  controllers: [BetsController],
  providers: [BetsService, PrismaService, CompetitionAccessService],
  exports: [BetsService],
})
export class BetsModule {}
