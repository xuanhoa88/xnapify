import { createFactory } from '@shared/api/engines/hook/factory';

import { logoutUser } from './auth.service';

describe('auth.service hook emits', () => {
  test('logoutUser emits logout on auth channel and handler receives bound context', async () => {
    const factory = createFactory();
    const ctx = { appName: 'testApp' };
    const hook = factory.withContext(ctx);

    let called = false;
    const userId = 'user-123';

    const authChannel = hook('auth');
    authChannel.on('logout', function (payload) {
      expect(this).toBe(ctx);
      expect(payload).toEqual({ user_id: userId });
      called = true;
    });

    await logoutUser(userId, { hook });

    expect(called).toBe(true);
  });
});
