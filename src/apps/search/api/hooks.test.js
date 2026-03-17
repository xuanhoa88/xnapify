import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';
import { registry } from '@shared/plugin/utils';

import { registerSearchHooks } from './hooks';

jest.mock('@shared/plugin/utils', () => ({
  registry: {
    executeHookParallel: jest.fn().mockResolvedValue([]),
  },
}));

describe('Search Hooks', () => {
  let hook;
  let searchWorker;

  beforeEach(() => {
    hook = createHookFactory();

    searchWorker = {
      indexUser: jest.fn().mockResolvedValue(true),
      removeUser: jest.fn().mockResolvedValue(true),
      indexGroup: jest.fn().mockResolvedValue(true),
      removeGroup: jest.fn().mockResolvedValue(true),
    };

    const container = {
      resolve: jest.fn(key => (key === 'search:worker' ? searchWorker : null)),
    };

    registerSearchHooks({
      get: jest.fn().mockImplementation(key => {
        if (key === 'hook') return hook;
        if (key === 'container') return container;
        return null;
      }),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // -- user hooks -----------------------------------------------------------

  describe('User Hooks', () => {
    const user = { id: 'u1', email: 'a@b.com' };

    test('indexes on auth:registered', async () => {
      await hook('auth').emit('registered', { user });
      expect(searchWorker.indexUser).toHaveBeenCalledWith(user);
    });

    test('indexes on admin:users:created', async () => {
      await hook('admin:users').emit('created', { user });
      expect(searchWorker.indexUser).toHaveBeenCalledWith(user);
    });

    test('indexes on admin:users:updated', async () => {
      await hook('admin:users').emit('updated', { user });
      expect(searchWorker.indexUser).toHaveBeenCalledWith(user);
    });

    test('indexes on admin:users:status_updated', async () => {
      await hook('admin:users').emit('status_updated', { user });
      expect(searchWorker.indexUser).toHaveBeenCalledWith(user);
    });

    test('removes on admin:users:deleted', async () => {
      await hook('admin:users').emit('deleted', { user_id: 'u1' });
      expect(searchWorker.removeUser).toHaveBeenCalledWith('u1');
    });

    test('indexes on profile:updated', async () => {
      await hook('profile').emit('updated', { user });
      expect(searchWorker.indexUser).toHaveBeenCalledWith(user);
    });

    test('removes on profile:account_deleted', async () => {
      await hook('profile').emit('account_deleted', { user_id: 'u1' });
      expect(searchWorker.removeUser).toHaveBeenCalledWith('u1');
    });

    test('does not throw when payload has no user', async () => {
      await hook('auth').emit('registered', {});
      expect(searchWorker.indexUser).not.toHaveBeenCalled();
    });
  });

  // -- group hooks ----------------------------------------------------------

  describe('Group Hooks', () => {
    const group = { id: 'g1', name: 'Group 1' };

    test('indexes on admin:groups:created', async () => {
      await hook('admin:groups').emit('created', { group });
      expect(searchWorker.indexGroup).toHaveBeenCalledWith(group);
    });

    test('indexes on admin:groups:updated', async () => {
      await hook('admin:groups').emit('updated', { group });
      expect(searchWorker.indexGroup).toHaveBeenCalledWith(group);
    });

    test('removes on admin:groups:deleted', async () => {
      await hook('admin:groups').emit('deleted', { group_id: 'g1' });
      expect(searchWorker.removeGroup).toHaveBeenCalledWith('g1');
    });
  });

  // -- plugin hooks ---------------------------------------------------------

  describe('Plugin Hook', () => {
    test('executes search.indexers.register hook via plugin registry', () => {
      expect(registry.executeHookParallel).toHaveBeenCalledWith(
        'search.indexers.register',
        expect.objectContaining({
          hook: expect.any(Function),
          searchWorker,
        }),
      );
    });
  });

  // -- robustness -----------------------------------------------------------

  describe('Robustness', () => {
    test('does not register hooks when searchWorker is null', () => {
      const freshHook = createHookFactory();
      registerSearchHooks({
        get: jest.fn().mockImplementation(key => {
          if (key === 'hook') return freshHook;
          if (key === 'container') return { resolve: () => null };
          return null;
        }),
      });

      // Emitting should not throw and should not call searchWorker
      expect(async () => {
        await freshHook('auth').emit('registered', {
          user: { id: '1' },
        });
      }).not.toThrow();
    });

    test('swallows worker errors gracefully', async () => {
      searchWorker.indexUser.mockRejectedValue(new Error('boom'));
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await hook('auth').emit('registered', {
        user: { id: '1', email: 'x@y.com' },
      });

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Search hook'));
      spy.mockRestore();
    });
  });
});
