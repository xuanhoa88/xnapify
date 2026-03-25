/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import {
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
  INITIALIZED,
} from '../utils/BaseExtensionManager';
import { registry } from '../utils/Registry';

import serverManager from './ExtensionManager';

// Mock Registry
jest.mock('../utils/Registry', () => ({
  registry: {
    defineExtension: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue(true),
    unregister: jest.fn().mockResolvedValue(true),
  },
}));

describe('ServerExtensionManager', () => {
  let mockContext;

  beforeEach(async () => {
    // Reset singleton state manually since it's a singleton
    serverManager[ACTIVE_EXTENSIONS].clear();
    serverManager[EXTENSION_METADATA].clear();
    serverManager[INITIALIZED] = false;

    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };

    const mockContainer = {
      resolve: jest.fn(key => {
        if (key === 'cwd') return '/test/cwd';
        return undefined;
      }),
    };

    // Initialize properly
    await serverManager.init(mockContext.fetch, mockContainer);

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('_resolveEntryPoint', () => {
    it('resolves server.js for browser extensions', () => {
      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._resolveEntryPoint({ browser: 'index.js' })).toBe(
        'server.js',
      );
    });

    it('resolves api.js for main-only extensions', () => {
      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._resolveEntryPoint({ main: 'api.js' })).toBe(
        'api.js',
      );
    });
  });

  describe('_bootstrapExtension', () => {
    it('throws if extension name is missing', async () => {
      await expect(
        // eslint-disable-next-line no-underscore-dangle
        serverManager._bootstrapExtension('test', 'api.js', {}, {}),
      ).rejects.toThrow('Extension name required');
    });

    it('loads and boots API extension', async () => {
      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      const mockApi = {
        boot: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockReturnValue('/abs/path/api.js');

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._bootstrapExtension(
        'test',
        'api.js',
        manifest,
        {},
      );

      expect(mockApi.boot).toHaveBeenCalledWith(
        registry,
        expect.objectContaining({ container: expect.any(Object) }),
      );
      expect(result).toBeDefined();
      // Merged result contains the apiModule properties
      expect(result.boot).toBe(mockApi.boot);
    });

    it('loads View module from server.js', async () => {
      const manifest = {
        name: 'test_extension',
        id: 'test',
        browser: 'src/index.js',
      };

      const mockView = { default: { name: 'ViewExtension' } };
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockView);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockReturnValue('/abs/path/server.js');

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._bootstrapExtension(
        'test',
        'server.js',
        manifest,
        {},
      );

      // Result is a merged spread, not the original reference
      expect(result).toStrictEqual(mockView.default);
    });
  });

  describe('installExtension', () => {
    it('calls install hook if exported by extension API', async () => {
      const mockApi = { install: jest.fn().mockResolvedValue() };
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_extension', main: 'api.js' };

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(serverManager.requireModule).toHaveBeenCalledWith(
        '/abs/path/api.js',
      );
      expect(mockApi.install).toHaveBeenCalledWith(
        registry,
        expect.objectContaining({ container: expect.any(Object) }),
      );
      expect(result).toBe(true);
    });

    it('skips install hook if not exported', async () => {
      const mockApi = { init: jest.fn() }; // no install()
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_extension', main: 'api.js' };

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(mockApi.init).not.toHaveBeenCalled();
      expect(result).toBe(true); // Still conceptually successful (no-op)
    });

    it('skips install hook if manifest has no main', async () => {
      const manifest = { name: 'test_extension' }; // no "main"

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(result).toBe(true);
    });
  });

  describe('uninstallExtension', () => {
    it('calls uninstall hook if exported by extension API', async () => {
      const mockApi = { uninstall: jest.fn().mockResolvedValue() };
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockReturnValue('/abs/path/api.js');

      const manifest = { name: 'test_extension', main: 'api.js' };

      const result = await serverManager.uninstallExtension(
        'test_extension_id',
        manifest,
      );

      expect(serverManager.requireModule).toHaveBeenCalledWith(
        '/abs/path/api.js',
      );
      expect(mockApi.uninstall).toHaveBeenCalledWith(
        registry,
        expect.objectContaining({ container: expect.any(Object) }),
      );
      expect(result).toBe(true);
    });
  });

  describe('connectViewRouter', () => {
    let mockViewRouter;
    let mockApiRouter;

    beforeEach(() => {
      mockViewRouter = { add: jest.fn(() => []), remove: jest.fn() };
      mockApiRouter = { add: jest.fn(() => []), remove: jest.fn() };
    });

    it('injects buffered view routes into the router', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Buffer a view route (no router yet)
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');

      // Connect view router — should flush buffered adapter
      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('re-injects stored adapters on subsequent connect (SSR per-request)', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Buffer and connect
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');
      serverManager.connectViewRouter(mockViewRouter);
      expect(mockViewRouter.add).toHaveBeenCalledTimes(1);

      // New router (next SSR request)
      const newRouter = { add: jest.fn(() => []), remove: jest.fn() };
      serverManager.connectViewRouter(newRouter);

      expect(newRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('buffers both view and api routes then injects view routes on connect', () => {
      const viewAdapter = { files: () => [], load: () => ({}) };
      const apiAdapter = { files: () => [], load: () => ({}) };

      // Buffer both types (no routers available yet)
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', viewAdapter, 'views');
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', apiAdapter, 'api');

      // connectViewRouter — should inject view routes, api stays stored
      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(viewAdapter);
      // API adapter was stored but no apiRouter to inject into
      expect(mockApiRouter.add).not.toHaveBeenCalled();
    });

    it('handles null viewRouter without crash', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Buffer a route
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');

      // Should not crash
      expect(() => serverManager.connectViewRouter(null)).not.toThrow();

      // Now connect real router — stored adapter should inject
      serverManager.connectViewRouter(mockViewRouter);
      expect(mockViewRouter.add).toHaveBeenCalledWith(mockAdapter);
    });
  });
});
