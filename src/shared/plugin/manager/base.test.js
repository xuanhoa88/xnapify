/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

// eslint-disable-next-line no-underscore-dangle
global.__DEV__ = false;

import {
  BasePluginManager,
  PluginState,
  ACTIVE_PLUGINS,
  INITIALIZED,
  PLUGIN_METADATA,
} from './base';
import { registry } from '../Registry';

// Mock Registry
jest.mock('../Registry', () => ({
  registry: {
    define: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue(true),
    unregister: jest.fn().mockResolvedValue(true),
    getDefinitions: jest.fn(),
    has: jest.fn(),
  },
}));

// Mock i18n utilities used by translations phase
jest.mock('../../i18n/utils', () => ({
  addNamespace: jest.fn(),
}));
jest.mock('../../i18n/loader', () => ({
  getTranslations: jest.fn(ctx => ctx),
}));

describe('BasePluginManager', () => {
  let manager;
  let mockContext;

  beforeEach(() => {
    manager = new BasePluginManager();
    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { plugins: [] } }),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init', () => {
    it('throws error if context has no fetch', async () => {
      await expect(manager.init({})).rejects.toThrow(
        'PluginManager requires a valid context with fetch method',
      );
    });

    it('initializes once and calls fetchAll', async () => {
      const fetchAllSpy = jest.spyOn(manager, 'fetchAll').mockResolvedValue();

      await manager.init(mockContext);
      expect(manager[INITIALIZED]).toBe(true);
      expect(fetchAllSpy).toHaveBeenCalledTimes(1);

      // Second call should skip
      await manager.init(mockContext);
      expect(fetchAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchAll', () => {
    it('fetches plugins and calls loadPlugin for each', async () => {
      mockContext.fetch.mockResolvedValue({
        data: {
          plugins: [
            { id: 'plugin-1', version: '1.0' },
            'plugin-2', // test string format too
          ],
        },
      });

      const loadPluginSpy = jest
        .spyOn(manager, 'loadPlugin')
        .mockResolvedValue();

      await manager.init(mockContext);

      expect(mockContext.fetch).toHaveBeenCalledWith('/api/plugins');
      expect(loadPluginSpy).toHaveBeenCalledWith(
        'plugin-1',
        expect.any(Object),
      );
      expect(loadPluginSpy).toHaveBeenCalledWith('plugin-2', null);
    });
  });

  describe('loadPlugin', () => {
    it('skips if already loaded', async () => {
      manager[ACTIVE_PLUGINS].set('existing', {});
      const result = await manager.loadPlugin('existing');
      expect(result).toBeDefined();
      expect(mockContext.fetch).not.toHaveBeenCalled();
    });

    it('successfully loads a plugin', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext); // Set context

      mockContext.fetch.mockResolvedValue({
        success: true,
        data: {
          containerName: 'test_container',
          manifest: { id: 'test-plugin', main: 'index.js' },
        },
      });

      // Mock resolved entry point
      jest.spyOn(manager, 'resolveEntryPoint').mockReturnValue('index.js');

      const mockPluginInstance = { name: 'Test Plugin', onLoad: jest.fn() };
      jest
        .spyOn(manager, 'executePlugin')
        .mockResolvedValue(mockPluginInstance);

      const result = await manager.loadPlugin('test-plugin');

      expect(result).toBe(mockPluginInstance);
      expect(registry.define).toHaveBeenCalledWith(
        mockPluginInstance,
        mockContext,
        { id: 'test-plugin', main: 'index.js' },
      );
      expect(mockPluginInstance.onLoad).toHaveBeenCalledWith(mockContext);

      const meta = manager[PLUGIN_METADATA].get('test-plugin');
      expect(meta.state).toBe(PluginState.LOADED);
    });

    it('handles load failure', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      mockContext.fetch.mockResolvedValue({
        success: false,
        message: 'Not found',
      });

      await manager.loadPlugin('fail-plugin');

      const meta = manager[PLUGIN_METADATA].get('fail-plugin');
      expect(meta.state).toBe(PluginState.FAILED);
      expect(meta.error.message).toBe('Not found');
    });
  });

  describe('loadDependencies', () => {
    it('skips loading if all dependencies are already active', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      manager[ACTIVE_PLUGINS].set('dep-1', {});
      const loadPluginSpy = jest.spyOn(manager, 'loadPlugin');

      await manager.loadDependencies('plugin-1', { 'dep-1': '^1.0.0' });

      expect(loadPluginSpy).not.toHaveBeenCalled();
    });

    it('loads missing dependencies in parallel', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      manager[ACTIVE_PLUGINS].set('existing-dep', {});
      const loadPluginSpy = jest
        .spyOn(manager, 'loadPlugin')
        .mockResolvedValue({});

      await manager.loadDependencies('plugin-1', {
        'existing-dep': '^1.0.0',
        'missing-dep-1': '^2.0.0',
        'missing-dep-2': '^3.0.0',
      });

      expect(loadPluginSpy).toHaveBeenCalledTimes(2);
      expect(loadPluginSpy).toHaveBeenCalledWith('missing-dep-1');
      expect(loadPluginSpy).toHaveBeenCalledWith('missing-dep-2');
    });
  });

  describe('unloadPlugin', () => {
    it('unregisters plugin from registry', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      const mockPlugin = { onUnload: jest.fn() };
      manager[ACTIVE_PLUGINS].set('p1', mockPlugin);
      manager[PLUGIN_METADATA].set('p1', { state: PluginState.LOADED });

      await manager.unloadPlugin('p1');

      expect(mockPlugin.onUnload).toHaveBeenCalledWith(mockContext);
      expect(registry.unregister).toHaveBeenCalledWith('p1', mockContext);
      expect(manager[ACTIVE_PLUGINS].has('p1')).toBe(false);
      expect(manager[PLUGIN_METADATA].get('p1').state).toBe(
        PluginState.UNLOADED,
      );
    });
  });

  describe('loadNamespace', () => {
    it('activates plugins for a namespace', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      const mockDef = { id: 'p1', init: jest.fn() };
      registry.getDefinitions.mockReturnValue(new Set([mockDef]));

      await manager.loadNamespace('ui');

      expect(registry.register).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ id: 'p1' }),
      );
      expect(manager[ACTIVE_PLUGINS].has('p1')).toBe(true);

      // Verify init wrapper
      const registeredInstance = registry.register.mock.calls[0][1];
      await registeredInstance.init(registry);
      expect(mockDef.init).toHaveBeenCalledWith(registry, mockContext);
    });
  });
});
