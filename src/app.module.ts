import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PlatformModule } from './platform/platform.module';
import { GamesModule } from './games/games.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { environmentValidationSchema } from './config/environment.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: environmentValidationSchema,
    }),
    PlatformModule,
    GamesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
