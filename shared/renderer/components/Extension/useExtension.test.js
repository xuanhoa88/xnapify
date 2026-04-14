/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import { useMemo } from 'react';

import renderer, { act } from 'react-test-renderer';

import { registry } from '@shared/extension/client/Registry';

import { ExtensionProvider } from '../../Providers/Extension';

import {
  useExtensionHooks,
  useExtensionValidator,
  useExtensionFormData,
  useExtensionRegistry,
} from './useExtension';

// Mock Registry
jest.mock('@shared/extension/client/Registry', () => ({
  registry: {
    executeHook: jest.fn(),
  },
}));

describe('useExtension', () => {
  let comp;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (comp) {
      act(() => {
        comp.unmount();
      });
      comp = null;
    }
    jest.restoreAllMocks();
  });

  describe('useExtensionRegistry', () => {
    it('returns the registry from ExtensionContext', () => {
      let currentRegistry;
      const Dummy = () => {
        currentRegistry = useExtensionRegistry();
        return null;
      };

      act(() => {
        comp = renderer.create(
          <ExtensionProvider registry={registry}>
            <Dummy />
          </ExtensionProvider>,
        );
      });

      expect(currentRegistry).toBe(registry);
    });

    it('returns null when outside of ExtensionProvider', () => {
      let currentRegistry = 'not-null';
      const Dummy = () => {
        currentRegistry = useExtensionRegistry();
        return null;
      };

      act(() => {
        comp = renderer.create(<Dummy />);
      });

      expect(currentRegistry).toBeNull();
    });
  });

  describe('useExtensionHooks', () => {
    it('returns an execute function that calls registry.executeHook', async () => {
      const mockResult = [{ success: true }];
      registry.executeHook.mockResolvedValue(mockResult);

      let hooks;
      const Dummy = () => {
        hooks = useExtensionHooks();
        return null;
      };

      act(() => {
        comp = renderer.create(
          <ExtensionProvider registry={registry}>
            <ExtensionProvider registry={registry}><Dummy /></ExtensionProvider>
          </ExtensionProvider>,
        );
      });

      const res = await hooks.execute('test.hook', 'arg1');

      expect(registry.executeHook).toHaveBeenCalledWith('test.hook', 'arg1');
      expect(res).toBe(mockResult);
    });
  });

  describe('useExtensionValidator', () => {
    it('should execute hook and extend schema sequentially', async () => {
      registry.executeHook.mockResolvedValue([
        { first: true },
        { second: true },
      ]);

      let resultSchema;
      let isLoading;

      const Dummy = () => {
        const baseSchema = useMemo(() => ({ base: true }), []);
        const validator = useMemo(() => ({ validator: 'zod' }), []);
        const [schema, loading] = useExtensionValidator(
          'test.validator',
          baseSchema,
          validator,
        );
        resultSchema = schema;
        isLoading = loading;
        return null;
      };

      await act(async () => {
        comp = renderer.create(<ExtensionProvider registry={registry}><Dummy /></ExtensionProvider>);
      });

      expect(isLoading).toBe(false);
      expect(resultSchema).toEqual({ second: true });
    });

    it('should handle errors gracefully', async () => {
      registry.executeHook.mockRejectedValue(new Error('Hook Failed'));

      let resultSchema;
      let isLoading;

      const Dummy = () => {
        const baseSchema = useMemo(() => ({ base: true }), []);
        const [schema, loading] = useExtensionValidator(
          'test.error',
          baseSchema,
          'dummy-validator',
        );
        resultSchema = schema;
        isLoading = loading;
        return null;
      };

      await act(async () => {
        comp = renderer.create(<ExtensionProvider registry={registry}><Dummy /></ExtensionProvider>);
      });

      expect(isLoading).toBe(false);
      expect(resultSchema).toEqual({ base: true });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('useExtensionFormData', () => {
    it('should aggregate form data from multiple extensions', async () => {
      registry.executeHook.mockResolvedValue([
        { field1: 'value1' },
        { field2: 'value2' },
      ]);

      let resultData;
      let isLoading;

      const Dummy = () => {
        const context = useMemo(() => ({ user: '1' }), []);
        const [data, loading] = useExtensionFormData('test.form', context);
        resultData = data;
        isLoading = loading;
        return null;
      };

      await act(async () => {
        comp = renderer.create(<ExtensionProvider registry={registry}><Dummy /></ExtensionProvider>);
      });

      expect(isLoading).toBe(false);
      expect(resultData).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('returns empty when no context provided', async () => {
      let isLoading;
      const Dummy = () => {
        const [, loading] = useExtensionFormData('test.no-ctx', null);
        isLoading = loading;
        return null;
      };

      await act(async () => {
        comp = renderer.create(<ExtensionProvider registry={registry}><Dummy /></ExtensionProvider>);
      });

      expect(isLoading).toBe(false);
      expect(registry.executeHook).not.toHaveBeenCalled();
    });
  });
});
