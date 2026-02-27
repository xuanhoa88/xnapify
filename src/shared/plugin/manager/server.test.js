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
    it('throws if internalId is missing', async () => {
      await expect(
        serverManager.loadPluginModule('test', 'api.js', {}, {}),
      ).rejects.toThrow('Internal ID required');
    });

    it('loads and boots API plugin', async () => {
      const internalId = 'plugin-uuid';
      const manifest = { id: 'test', main: 'api.js', internalId };

      const mockApi = {
        init: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, 'getPluginBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const result = await serverManager.loadPluginModule(
        'test',
        'api.js',
        manifest,
        { internalId },
      );

      expect(mockApi.init).toHaveBeenCalledWith(registry, mockContext);
      expect(result).toBeDefined();
      expect(result.name).toBe('test');
    });

    it('loads View module from server.js', async () => {
      const internalId = 'plugin-uuid';
      const manifest = { id: 'test', browser: 'src/index.js', internalId };

      const mockView = { default: { name: 'ViewPlugin' } };
      jest.spyOn(serverManager, 'loadModule').mockReturnValue(mockView);
      jest
        .spyOn(serverManager, 'getPluginBundlePath')
        .mockReturnValue('/abs/path/server.js');

      const result = await serverManager.loadPluginModule(
        'test',
        'server.js',
        manifest,
        { internalId },
      );

      expect(result).toBe(mockView.default);
    });
  });

  describe('CSS handling', () => {
    it('stores CSS URLs on plugin:loaded event', async () => {
      const manifest = { cssFiles: ['style.css'] };
      serverManager[PLUGIN_METADATA].set('p1', { manifest });

      await serverManager.emit('plugin:loaded', { id: 'p1' });

      const cssUrls = serverManager.getPluginCssUrls();
      expect(cssUrls).toContain('/api/plugins/p1/static/style.css');
    });
  });
});
