import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PlatformModule } from './platform/platform.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [PlatformModule, GamesModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
