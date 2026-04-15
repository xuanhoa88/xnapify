/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
    serverManager[ACTIVE_EXTENSIONS].clear();
    serverManager[EXTENSION_METADATA].clear();

    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };

    serverManager.fetch = mockContext.fetch;

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Manifest Reading
  // ---------------------------------------------------------------------------

  describe('readManifest', () => {
    let mockFs;
    beforeEach(() => {
      // Import the fs module to mock it
      mockFs = require('fs').promises;
      jest.spyOn(mockFs, 'readFile');
    });

    it('loads package.json and parses stats.json if present', async () => {
      mockFs.readFile.mockImplementation(async pathStr => {
        if (pathStr.endsWith('package.json')) {
          return JSON.stringify({
            name: 'test_extension',
            id: 'built_ext_id',
          });
        }
        if (pathStr.endsWith('stats.json')) {
          return JSON.stringify({
            'extension.css': 'extension.abcd.css',
            'remote.js': 'remote.1234.js',
          });
        }
        throw new Error('File not found');
      });

      const manifest = await serverManager.readManifest('/tmp/ext');

      // id comes from the built manifest (written at build time)
      expect(manifest.id).toBe('built_ext_id');
      expect(manifest.buildManifest).toEqual({
        'extension.css': 'extension.abcd.css',
        'remote.js': 'remote.1234.js',
      });
      expect(manifest.hasClientCss).toBe(true);
      expect(manifest.hasClientScript).toBe(true);
    });

    it('falls back to file existence if stats.json is missing', async () => {
      mockFs.readFile.mockImplementation(async pathStr => {
        if (pathStr.endsWith('package.json')) {
          return JSON.stringify({ name: 'test_dev_ext' });
        }
        throw new Error('File not found'); // stats.json missing
      });

      // When stats.json is missing, readManifest falls back to
      // fileExists() checks. Since the test paths don't exist on disk,
      // hasClientCss / hasClientScript will be false — the key assertion
      // is that buildManifest is null and the method doesn't throw.
      // id is undefined for unbuilt source extensions with no pre-generated id.
      const manifest = await serverManager.readManifest('/tmp/ext');

      expect(manifest.id).toBeNull();
      expect(manifest.buildManifest).toBeNull();
      expect(manifest.hasClientCss).toBeUndefined();
      expect(manifest.hasClientScript).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Entry Point Resolution
  // ---------------------------------------------------------------------------

  describe('_resolveEntryPoint', () => {
    it('resolves server.js for browser extensions via buildManifest', () => {
      const manifest = {
        browser: 'index.js',
        buildManifest: { 'server.js': 'server.hash123.js' },
      };
      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._resolveEntryPoint(manifest)).toBe(
        'server.hash123.js',
      );
    });

    it('resolves server.js gracefully if buildManifest is missing', () => {
      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._resolveEntryPoint({ browser: 'index.js' })).toBe(
        'server.js',
      );
    });

    it('resolves api.js for main-only extensions', () => {
      const manifest = { main: './api.a1b2c3d4.js' };
      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._resolveEntryPoint(manifest)).toBe(
        'api.a1b2c3d4.js',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Module Loading
  // ---------------------------------------------------------------------------

  describe('_loadExtensionModule', () => {
    it('returns fallback object for extensions without view module', async () => {
      jest.spyOn(serverManager, '_loadViewModule').mockResolvedValue(null);

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._loadExtensionModule(
        'test',
        'server.js',
        {},
      );

      // Returns a minimal { boot() {} } so the lifecycle continues
      expect(result).toBeDefined();
      expect(typeof result.boot).toBe('function');
    });

    it('returns fallback object for API-only extensions', async () => {
      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      jest.spyOn(serverManager, '_loadViewModule').mockResolvedValue(null);

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._loadExtensionModule(
        'test',
        'server.js',
        manifest,
      );

      expect(result).toBeDefined();
      expect(typeof result.boot).toBe('function');
    });

    it('returns view module when available', async () => {
      const manifest = {
        name: 'test_extension',
        id: 'test',
        browser: 'src/index.js',
      };
      const mockViewModule = { name: 'ViewExtension', routes: jest.fn() };

      jest
        .spyOn(serverManager, '_loadViewModule')
        .mockResolvedValue(mockViewModule);

      // eslint-disable-next-line no-underscore-dangle
      const result = await serverManager._loadExtensionModule(
        'test',
        'server.js',
        manifest,
      );

      expect(result).toBe(mockViewModule);
    });
  });

  // ---------------------------------------------------------------------------
  // Install / Uninstall Lifecycle
  // ---------------------------------------------------------------------------

  describe('installExtension', () => {
    it('calls install hook if exported by extension API', async () => {
      const mockApi = { install: jest.fn().mockResolvedValue() };

      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(mockApi);

      serverManager.apiContainer = {
        resolve: jest.fn().mockReturnValue(null),
      };

      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._requireApiModule).toHaveBeenCalledWith(manifest);
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
      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(mockApi);

      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(mockApi.init).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('skips install hook if manifest has no main', async () => {
      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(null);

      const manifest = { name: 'test_extension', id: 'test' }; // no "main"

      const result = await serverManager.installExtension(
        'test_extension_id',
        manifest,
      );

      expect(result).toBe(true);
    });

    it('rejects invalid extension ID', async () => {
      const result = await serverManager.installExtension('', {});
      expect(result).toBe(false);
    });
  });

  describe('uninstallExtension', () => {
    it('calls uninstall hook if exported by extension API', async () => {
      const mockApi = { uninstall: jest.fn().mockResolvedValue() };

      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(mockApi);

      serverManager.apiContainer = {
        resolve: jest.fn().mockReturnValue(null),
      };

      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      const result = await serverManager.uninstallExtension(
        'test_extension_id',
        manifest,
      );

      // eslint-disable-next-line no-underscore-dangle
      expect(serverManager._requireApiModule).toHaveBeenCalledWith(manifest);
      expect(mockApi.uninstall).toHaveBeenCalledWith(
        expect.objectContaining({
          container: expect.any(Object),
          registry: expect.any(Object),
        }),
      );
      expect(result).toBe(true);
    });

    it('auto-reverts seeds and migrations before uninstall hook', async () => {
      const mockRevertSeeds = jest.fn().mockResolvedValue();
      const mockRevertMigrations = jest.fn().mockResolvedValue();
      const mockApi = {
        seeds: jest.fn(() => ({ up: jest.fn() })),
        migrations: jest.fn(() => ({ up: jest.fn() })),
        uninstall: jest.fn().mockResolvedValue(),
      };

      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(mockApi);

      serverManager.apiContainer = {
        resolve: jest.fn().mockReturnValue({
          connection: {
            revertSeeds: mockRevertSeeds,
            revertMigrations: mockRevertMigrations,
          },
        }),
      };

      const manifest = { name: 'test_extension', id: 'test', main: 'api.js' };

      await serverManager.uninstallExtension('test_extension_id', manifest);

      // Seeds reverted before migrations
      expect(mockRevertSeeds).toHaveBeenCalled();
      expect(mockRevertMigrations).toHaveBeenCalled();
      // Then custom hook runs
      expect(mockApi.uninstall).toHaveBeenCalled();
    });

    it('skips uninstall hook if API module has no exports', async () => {
      jest.spyOn(serverManager, '_requireApiModule').mockResolvedValue(null);

      const manifest = { name: 'test_extension', id: 'test' };

      const result = await serverManager.uninstallExtension(
        'test_extension_id',
        manifest,
      );

      expect(result).toBe(true);
    });

    it('rejects invalid extension ID', async () => {
      const result = await serverManager.uninstallExtension('', {});
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Router Connection
  // ---------------------------------------------------------------------------

  describe('router connection', () => {
    let mockViewRouter;
    let mockApiRouter;

    beforeEach(() => {
      mockViewRouter = { add: jest.fn(() => []), remove: jest.fn() };
      mockApiRouter = { add: jest.fn(() => []), remove: jest.fn() };
    });

    it('connectViewRouter injects buffered view routes', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');
      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('connectApiRouter injects buffered API routes', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'api');
      serverManager.connectApiRouter(mockApiRouter);

      expect(mockApiRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('re-injects stored adapters on subsequent connectViewRouter (SSR per-request)', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');
      serverManager.connectViewRouter(mockViewRouter);
      expect(mockViewRouter.add).toHaveBeenCalledTimes(1);

      const newRouter = { add: jest.fn(() => []), remove: jest.fn() };
      serverManager.connectViewRouter(newRouter);

      expect(newRouter.add).toHaveBeenCalledWith(mockAdapter);
    });

    it('drains only matching routes per router type', () => {
      const viewAdapter = { files: () => [], load: () => ({}) };
      const apiAdapter = { files: () => [], load: () => ({}) };

      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', viewAdapter, 'views');
      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', apiAdapter, 'api');

      serverManager.connectViewRouter(mockViewRouter);

      expect(mockViewRouter.add).toHaveBeenCalledWith(viewAdapter);
      expect(mockApiRouter.add).not.toHaveBeenCalled();

      serverManager.connectApiRouter(mockApiRouter);

      expect(mockApiRouter.add).toHaveBeenCalledWith(apiAdapter);
    });

    it('handles null viewRouter without crash', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // eslint-disable-next-line no-underscore-dangle
      serverManager._injectRoutes('test-ext', mockAdapter, 'views');

      expect(() => serverManager.connectViewRouter(null)).not.toThrow();

      serverManager.connectViewRouter(mockViewRouter);
      expect(mockViewRouter.add).toHaveBeenCalledWith(mockAdapter);
    });
  });
});
