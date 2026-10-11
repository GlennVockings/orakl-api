import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth-request';
import { JwtVerifierService } from './jwt-verifier.service';

function getBearerToken(request: Request): string | null {
  const authHeader = request.header('authorization');

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
  constructor(private readonly jwtVerifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = await this.jwtVerifier.verify(token);

    return true;
  }
}
