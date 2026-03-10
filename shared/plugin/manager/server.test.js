/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import serverManager from './server';
import { ACTIVE_PLUGINS, PLUGIN_METADATA, INITIALIZED } from './base';
import { registry } from '../Registry';

// Mock Registry
jest.mock('../Registry', () => ({
  registry: {
    define: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue(true),
    unregister: jest.fn().mockResolvedValue(true),
  },
}));

describe('ServerPluginManager', () => {
  let mockContext;

  beforeEach(async () => {
    // Reset singleton state manually since it's a singleton
    serverManager[ACTIVE_PLUGINS].clear();
    serverManager[PLUGIN_METADATA].clear();
    serverManager[INITIALIZED] = false;

    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { plugins: [] } }),
      cwd: '/test/cwd',
    };

    // Initialize properly
    await serverManager.init(mockContext);

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveEntryPoint', () => {
    it('resolves server.js for browser plugins', () => {
      expect(serverManager.resolveEntryPoint({ browser: 'index.js' })).toBe(
        'server.js',
      );
    });

    it('resolves api.js for main-only plugins', () => {
      expect(serverManager.resolveEntryPoint({ main: 'api.js' })).toBe(
        'api.js',
      );
    });
  });

  describe('loadPluginModule', () => {
    it('throws if plugin name is missing', async () => {
      await expect(
        serverManager.loadPluginModule('test', 'api.js', {}, {}),
      ).rejects.toThrow('Plugin name required');
    });

    it('loads and boots API plugin', async () => {
      const manifest = { name: 'test_plugin', id: 'test', main: 'api.js' };

      const mockApi = {
        init: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getPluginBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const result = await serverManager.loadPluginModule(
        'test',
        'api.js',
        manifest,
        {},
      );

      expect(mockApi.init).toHaveBeenCalledWith(registry, mockContext);
      expect(result).toBeDefined();
      expect(result.name).toBe('test');
    });

    it('loads View module from server.js', async () => {
      const manifest = {
        name: 'test_plugin',
        id: 'test',
        browser: 'src/index.js',
      };

      const mockView = { default: { name: 'ViewPlugin' } };
      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockView);
      jest
        .spyOn(serverManager, '_getPluginBundlePath')
        .mockReturnValue('/abs/path/server.js');

      const result = await serverManager.loadPluginModule(
        'test',
        'server.js',
        manifest,
        {},
      );

      expect(result).toBe(mockView.default);
    });
  });

  describe('installPlugin', () => {
    it('calls install hook if exported by plugin API', async () => {
      const mockApi = { install: jest.fn().mockResolvedValue() };
      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getPluginBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_plugin', main: 'api.js' };

      const result = await serverManager.installPlugin(
        'test_plugin_id',
        manifest,
      );

      expect(serverManager.loadModule).toHaveBeenCalledWith('/abs/path/api.js');
      expect(mockApi.install).toHaveBeenCalledWith(registry, mockContext);
      expect(result).toBe(true);
    });

    it('skips install hook if not exported', async () => {
      const mockApi = { init: jest.fn() }; // no install()
      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getPluginBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_plugin', main: 'api.js' };

      const result = await serverManager.installPlugin(
        'test_plugin_id',
        manifest,
      );

      expect(mockApi.init).not.toHaveBeenCalled();
      expect(result).toBe(true); // Still conceptually successful (no-op)
    });

    it('skips install hook if manifest has no main', async () => {
      const manifest = { name: 'test_plugin' }; // no "main"

      const result = await serverManager.installPlugin(
        'test_plugin_id',
        manifest,
      );

      expect(result).toBe(true);
    });
  });

  describe('uninstallPlugin', () => {
    it('calls uninstall hook if exported by plugin API', async () => {
      const mockApi = { uninstall: jest.fn().mockResolvedValue() };
      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getPluginBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_plugin', main: 'api.js' };

      const result = await serverManager.uninstallPlugin(
        'test_plugin_id',
        manifest,
      );

      expect(serverManager.loadModule).toHaveBeenCalledWith('/abs/path/api.js');
      expect(mockApi.uninstall).toHaveBeenCalledWith(registry, mockContext);
      expect(result).toBe(true);
    });
  });
});
