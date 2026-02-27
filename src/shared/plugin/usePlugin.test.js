/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import renderer, { act } from 'react-test-renderer';
import {
  usePluginHooks,
  usePluginValidator,
  usePluginFormData,
} from './usePlugin';
import { registry } from './Registry';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('usePlugin', () => {
  beforeEach(() => {
    registry.clear();
  });

  describe('usePluginHooks', () => {
    it('returns an execute function that calls registry.executeHook', async () => {
      const mockResult = [{ success: true }];
      jest.spyOn(registry, 'executeHook').mockResolvedValue(mockResult);

      let hooks;
      const Dummy = () => {
        hooks = usePluginHooks();
        return null;
      };

      act(() => {
        renderer.create(<Dummy />);
      });

      const res = await hooks.execute('test.hook', 'arg1');

      expect(registry.executeHook).toHaveBeenCalledWith('test.hook', 'arg1');
      expect(res).toBe(mockResult);
      registry.executeHook.mockRestore();
    });
  });

  describe('usePluginValidator', () => {
    it('should execute hook and extend schema sequentially', async () => {
      registry.registerHook('test.validator', schema => ({
        ...schema,
        first: true,
      }));
      registry.registerHook('test.validator', schema => ({
        ...schema,
        second: true,
      }));

      let resultSchema;
      let isLoading;

      const Dummy = () => {
        const [schema, loading] = usePluginValidator(
          'test.validator',
          { base: true },
          { validator: 'zod' },
        );
        resultSchema = schema;
        isLoading = loading;
        return null;
      };

      let comp;
      await act(async () => {
        comp = renderer.create(<Dummy />);
      });

      expect(isLoading).toBe(false);
      expect(resultSchema).toEqual({ base: true, first: true, second: true });
    });

    it('should handle errors gracefully', async () => {
      registry.registerHook('test.error', () => {
        throw new Error('Hook Failed');
      });

      let resultSchema;
      let isLoading;

      const Dummy = () => {
        const [schema, loading] = usePluginValidator(
          'test.error',
          { base: true },
          'dummy-validator',
        );
        resultSchema = schema;
        isLoading = loading;
        return null;
      };

      await act(async () => {
        renderer.create(<Dummy />);
      });

      expect(isLoading).toBe(false);
      expect(resultSchema).toEqual({ base: true }); // Base schema remains untouched
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('usePluginFormData', () => {
    it('should aggregate form data from multiple plugins', async () => {
      registry.registerHook('test.form', () => ({ field1: 'value1' }));
      registry.registerHook('test.form', () => ({
        field2: 'value2',
        obj: { nested: 1 },
      }));

      let resultData;
      let isLoading;

      const Dummy = () => {
        const [data, loading] = usePluginFormData('test.form', { user: '1' });
        resultData = data;
        isLoading = loading;
        return null;
      };

      await act(async () => {
        renderer.create(<Dummy />);
      });

      expect(isLoading).toBe(false);
      expect(resultData).toEqual({
        field1: 'value1',
        field2: 'value2',
        obj: { nested: 1 },
      });
    });

    it('returns empty when no context provided', () => {
      let isLoading;
      const Dummy = () => {
        const [, loading] = usePluginFormData('test.no-ctx', null);
        isLoading = loading;
        return null;
      };

      act(() => {
        renderer.create(<Dummy />);
      });

      expect(isLoading).toBe(false);
    });
  });
});
