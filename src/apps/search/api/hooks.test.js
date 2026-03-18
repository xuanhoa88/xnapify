import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';

import { registerSearchHooks } from './hooks';

describe('Search Hooks', () => {
  describe('Plugin Hook Registration', () => {
    test('executes search.indexers.register hook via plugin registry', () => {
      const hook = createHookFactory();
      const registryMock = {
        executeHookParallel: jest.fn().mockResolvedValue([]),
      };

      const appMock = {
        get: jest.fn().mockImplementation(key => {
          if (key === 'hook') return hook;
          if (key === 'plugin') return { registry: registryMock };
          return null;
        }),
      };

      registerSearchHooks(appMock);

      expect(registryMock.executeHookParallel).toHaveBeenCalledWith(
        'search.indexers.register',
        appMock,
      );
    });
  });
});
