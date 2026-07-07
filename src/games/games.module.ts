import { Module } from '@nestjs/common';
import { FauxStakesModule } from './faux-stakes/faux-stakes.module';

@Module({
  imports: [FauxStakesModule],
  exports: [FauxStakesModule],
})
export class GamesModule {}
