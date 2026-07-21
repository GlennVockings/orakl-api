import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, jwt } from 'better-auth/plugins';
import type { OraklConfiguration } from '../../../config/configuration';

export function createBetterAuth(
  prisma: PrismaClient,
  config: ConfigService<OraklConfiguration, true>,
) {
  const options = {
    secret: config.get('auth.secret', {
      infer: true,
    }),
    baseURL: config.get('auth.baseUrl', {
      infer: true,
    }),
    basePath: '/api/auth',
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      fields: {
        name: 'displayName',
      },
    },
    plugins: [
      bearer(),
      jwt({
        jwt: {
          expirationTime: '1h',
        },
      }),
    ],
    trustedOrigins: config.get('auth.trustedOrigins', {
      infer: true,
    }),
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}
