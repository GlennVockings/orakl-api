import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../../prisma.service';
import { BetterAuthJwtGuard } from './better-auth-jwt.guard';
import { createBetterAuth } from './better-auth/better-auth.factory';

@Module({
  imports: [
    DatabaseModule,
    BetterAuthNestModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createBetterAuth(prisma),
        // Keep the existing per-controller JWT guard during migration.
        disableGlobalAuthGuard: true,
        // main.ts already owns application CORS.
        disableTrustedOriginsCors: true,
      }),
    }),
  ],
  providers: [BetterAuthJwtGuard],
  exports: [BetterAuthJwtGuard],
})
export class AuthModule {}
