import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth-request';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user is unavailable');
    }

    return userId;
  },
);
