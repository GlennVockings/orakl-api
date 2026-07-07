import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { PlatformModule } from './platform/platform.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [PlatformModule, GamesModule],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
