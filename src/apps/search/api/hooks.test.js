import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';

import { registerSearchHooks } from './hooks';

describe('Search Hooks', () => {
  describe('Extension Hook Registration', () => {
    test('executes search.indexers.register hook via extension registry', () => {
      const hook = createHookFactory();
      const registryMock = {
        executeHookParallel: jest.fn().mockResolvedValue([]),
      };

      const containerMock = {
        resolve: jest.fn().mockImplementation(name => {
          if (name === 'hook') return hook;
          if (name === 'extension') return { registry: registryMock };
          return null;
        }),
      };

      registerSearchHooks(containerMock);

      expect(registryMock.executeHookParallel).toHaveBeenCalledWith(
        'search.indexers.register',
        containerMock,
      );
    });
  });
});
