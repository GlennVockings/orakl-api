import type { PrismaClient } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, jwt } from 'better-auth/plugins';
import type { OraklConfiguration } from '../../../config/configuration';

export function createBetterAuth(
  prisma: PrismaClient,
  config: ConfigService<OraklConfiguration, true>,
) {
  return betterAuth({
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
  });
}
