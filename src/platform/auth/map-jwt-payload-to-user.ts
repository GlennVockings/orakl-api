import { UnauthorizedException } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import type { AuthenticatedUser } from './authenticated-user';

export function mapJwtPayloadToUser(payload: JWTPayload): AuthenticatedUser {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new UnauthorizedException('JWT payload is missing a valid subject');
  }

  return {
    id: payload.sub,
  };
}
