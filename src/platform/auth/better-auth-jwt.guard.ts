import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Request } from 'express';
import type { OraklConfiguration } from '../../config/configuration';
import type { AuthenticatedRequest } from './auth-request';
import { mapJwtPayloadToUser } from './map-jwt-payload-to-user';

function getBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

@Injectable()
export class BetterAuthJwtGuard implements CanActivate {
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService<OraklConfiguration, true>) {
    const jwksUrl = config.get('auth.jwksUrl', {
      infer: true,
    });

    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks);

      request.user = mapJwtPayloadToUser(payload);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid token');
    }
  }
}
