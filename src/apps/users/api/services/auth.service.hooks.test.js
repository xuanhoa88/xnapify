import { logoutUser } from './auth.service';
import { createFactory } from '@shared/api/engines/hook/factory';

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

    // Call logoutUser without webhook to avoid external calls
    await logoutUser(userId, { webhook: null, hook });

    expect(called).toBe(true);
  });
});
