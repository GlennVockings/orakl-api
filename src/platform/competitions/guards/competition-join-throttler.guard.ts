import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

@Injectable()
export class CompetitionJoinThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: AuthenticatedRequest): Promise<string> {
    const userId = req.user?.id;

    if (userId) {
      return Promise.resolve(`user:${userId}`);
    }

    return Promise.resolve(`ip:${req.ip}`);
  }
}
