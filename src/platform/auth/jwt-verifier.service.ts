import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { OraklConfiguration } from '../../config/configuration';
import type { AuthenticatedUser } from './authenticated-user';
import { mapJwtPayloadToUser } from './map-jwt-payload-to-user';

@Injectable()
export class JwtVerifierService {
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService<OraklConfiguration, true>) {
    const jwksUrl = config.get('auth.jwksUrl', {
      infer: true,
    });

    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks);

      return mapJwtPayloadToUser(payload);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid token');
    }
  }
}
