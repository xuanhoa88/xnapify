import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';

import { registerSearchHooks } from './hooks';

describe('Search Hooks', () => {
  describe('registerSearchHooks', () => {
    test('emits search:indexers register event via app hook system', () => {
      const hook = createHookFactory();

      const containerMock = {
        resolve: jest.fn().mockImplementation(name => {
          if (name === 'hook') return hook;
          return null;
        }),
      };

      // Listen for the register event
      const listener = jest.fn();
      hook('search:indexers').on('register', listener);

      registerSearchHooks(containerMock);

      expect(containerMock.resolve).toHaveBeenCalledWith('hook');
      expect(listener).toHaveBeenCalledWith(containerMock);
    });
  });
});
