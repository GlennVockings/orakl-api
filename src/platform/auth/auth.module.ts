import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../../prisma.service';
import { BetterAuthJwtGuard } from './better-auth-jwt.guard';
import { createBetterAuth } from './better-auth/better-auth.factory';
import { ConfigService } from '@nestjs/config';
import type { OraklConfiguration } from '../../config/configuration';

@Module({
  imports: [
    DatabaseModule,
    BetterAuthNestModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [PrismaService, ConfigService],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService<OraklConfiguration, true>,
      ) => ({
        auth: createBetterAuth(prisma, config),
        disableGlobalAuthGuard: true,
        disableTrustedOriginsCors: true,
      }),
    }),
  ],
  providers: [BetterAuthJwtGuard],
  exports: [BetterAuthJwtGuard],
})
export class AuthModule {}
