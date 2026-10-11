import { AuthenticatedUserThrottlerGuard } from './authenticated-user-throttler.guard';

describe('AuthenticatedUserThrottlerGuard', () => {
  function createGuard() {
    return Object.create(
      AuthenticatedUserThrottlerGuard.prototype,
    ) as AuthenticatedUserThrottlerGuard & {
      getTracker(req: { user?: { id?: string }; ip: string }): Promise<string>;
    };
  }

  it('tracks authenticated requests by user id', async () => {
    const guard = createGuard();

    await expect(
      guard.getTracker({
        user: { id: 'user-1' },
        ip: '203.0.113.10',
      }),
    ).resolves.toBe('user:user-1');
  });

  it('falls back to the request ip when no authenticated user is present', async () => {
    const guard = createGuard();

    await expect(
      guard.getTracker({
        ip: '203.0.113.10',
      }),
    ).resolves.toBe('ip:203.0.113.10');
  });
});
