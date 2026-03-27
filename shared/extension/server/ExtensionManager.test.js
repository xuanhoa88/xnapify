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
} from '../utils/BaseExtensionManager';

import serverManager from './ExtensionManager';

// Mock Registry
jest.mock('./Registry', () => ({
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

    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };

    // Initialize properly
    serverManager.fetch = mockContext.fetch;

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

  describe('_loadExtensionModule', () => {
    it('returns null if extension has no loadable modules', async () => {
      const result = await // eslint-disable-next-line no-underscore-dangle
      serverManager._loadExtensionModule('test', 'server.js', {});
      expect(result).toBeNull();
    });

    it('returns null for API-only extensions (no view module)', async () => {
      // API-only extension has main but no browser field
      const manifest = {
        name: 'test_extension',
        id: 'test',
        main: 'server.js',
      };

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._loadExtensionModule(
        'test',
        'server.js',
        manifest,
      );

      // API module loading is handled by the activate flow, not bootstrap
      expect(result).toBeNull();
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
      const result = await serverManager._loadExtensionModule(
        'test',
        'server.js',
        manifest,
      );

      expect(result).toStrictEqual(mockView.default);
    });
  });

  describe('installExtension', () => {
    it('calls install hook if exported by extension API', async () => {
      const mockApi = { install: jest.fn().mockResolvedValue() };
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockResolvedValue('/abs/path/api.js');

      serverManager.apiContainer = {
        resolve: jest.fn().mockReturnValue(null),
      };

      const manifest = { name: 'test_extension', main: 'api.js' };

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(serverManager.requireModule).toHaveBeenCalledWith(
        '/abs/path/api.js',
      );
      expect(mockApi.install).toHaveBeenCalledWith(
        expect.objectContaining({
          container: expect.any(Object),
          registry: expect.any(Object),
        }),
      );
      expect(result).toBe(true);
    });

    it('skips install hook if not exported', async () => {
      const mockApi = { init: jest.fn() }; // no install()
      jest.spyOn(serverManager, 'requireModule').mockReturnValue(mockApi);
      jest
        .spyOn(serverManager, '_getExtensionBundlePath')
        .mockResolvedValue('/abs/path/api.js');

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
        .mockResolvedValue('/abs/path/api.js');

      serverManager.apiContainer = {
        resolve: jest.fn().mockReturnValue(null),
      };

      const manifest = { name: 'test_extension', main: 'api.js' };

      const result = await serverManager.uninstallExtension(
        'test_extension_id',
        manifest,
      );

      expect(serverManager.requireModule).toHaveBeenCalledWith(
        '/abs/path/api.js',
      );
      expect(mockApi.uninstall).toHaveBeenCalledWith(
        expect.objectContaining({
          container: expect.any(Object),
          registry: expect.any(Object),
        }),
      );
      expect(result).toBe(true);
    });
  });

  describe('router connection', () => {
    let mockViewRouter;
    let mockApiRouter;

    beforeEach(() => {
      mockViewRouter = { add: jest.fn(() => []), remove: jest.fn() };
      mockApiRouter = { add: jest.fn(() => []), remove: jest.fn() };
    });

    it('connectViewRouter injects buffered view routes', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Buffer a view route (no router yet)
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');

      // Connect view router — should flush buffered adapter
      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('connectApiRouter injects buffered API routes', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Buffer an API route (no router yet)
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'api');

      // Connect API router — should flush buffered adapter
      serverManager.connectApiRouter(mockApiRouter);

      expect(mockApiRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('re-injects stored adapters on subsequent connectViewRouter (SSR per-request)', () => {
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

    it('drains only matching routes per router type', () => {
      const viewAdapter = { files: () => [], load: () => ({}) };
      const apiAdapter = { files: () => [], load: () => ({}) };

      // Buffer both types (no routers available yet)
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', viewAdapter, 'views');
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', apiAdapter, 'api');

      // connectViewRouter — should inject only view routes
      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(viewAdapter);
      expect(mockApiRouter.add).not.toHaveBeenCalled();

      // connectApiRouter — should inject only API routes
      serverManager.connectApiRouter(mockApiRouter);

      expect(mockApiRouter.add).toHaveBeenCalledWith(apiAdapter);
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
