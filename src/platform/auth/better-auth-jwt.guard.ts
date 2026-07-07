import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth-request';

const jwksUrl = new URL(
  process.env.BETTER_AUTH_JWKS_URL ?? 'http://localhost:3000/api/auth/jwks',
);
const JWKS = createRemoteJWKSet(jwksUrl);

function getBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization'); // ✅ typed helper from express
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

@Injectable()
export class BetterAuthJwtGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = getBearerToken(req);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const { payload } = await jwtVerify(token, JWKS);

      // attach for later use
      req.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
