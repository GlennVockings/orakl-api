import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import type { OraklConfiguration } from '../../config/configuration';
import { PrismaService } from '../../prisma.service';
import { DatabaseModule } from '../database/database.module';
import { BetterAuthJwtGuard } from './better-auth-jwt.guard';
import { createBetterAuth } from './better-auth/better-auth.factory';
import { JwtVerifierService } from './jwt-verifier.service';

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

  providers: [BetterAuthJwtGuard, JwtVerifierService],

  exports: [BetterAuthJwtGuard, JwtVerifierService],
})
export class AuthModule {}
