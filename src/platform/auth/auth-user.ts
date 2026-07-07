/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export function getUserIdFromJwtPayload(payload: any): string {
  // Better Auth JWT commonly uses "sub"
  if (payload?.sub && typeof payload.sub === 'string') return payload.sub;

  // fallback if you used "id"
  if (payload?.id && typeof payload.id === 'string') return payload.id;

  throw new Error('JWT payload missing user id (sub/id)');
}
