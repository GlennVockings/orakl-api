import type { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, jwt } from 'better-auth/plugins';

function getTrustedOrigins(): string[] {
  return (process.env.AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createBetterAuth(prisma: PrismaClient) {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }

  return betterAuth({
    secret,
    baseURL: process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:3001',
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
    trustedOrigins: getTrustedOrigins(),
  });
}
