import type { Request } from 'express';
import type { JWTPayload } from 'jose';

export type AuthenticatedRequest = Request & {
  user?: JWTPayload;
};
