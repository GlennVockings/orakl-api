export interface OraklConfiguration {
  app: {
    port: number;
  };

  auth: {
    secret: string;
    baseUrl: string;
    jwksUrl: string;
    trustedOrigins: string[];
  };
}

function parseTrustedOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default function configuration(): OraklConfiguration {
  return {
    app: {
      port: Number(process.env.PORT ?? 3001),
    },

    auth: {
      secret: process.env.BETTER_AUTH_SECRET ?? '',
      baseUrl: process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:3001',
      jwksUrl:
        process.env.BETTER_AUTH_JWKS_URL ??
        'http://localhost:3001/api/auth/jwks',
      trustedOrigins: parseTrustedOrigins(
        process.env.AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000',
      ),
    },
  };
}
