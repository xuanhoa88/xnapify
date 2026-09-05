/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/* global jest */

import {
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
} from '../utils/BaseExtensionManager.js';

import serverManager, { scopeRouteModule } from './ExtensionManager.js';

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

      expect(mockApiRouter.add).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.any(Function),
          load: expect.any(Function),
        }),
      );
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

      expect(mockApiRouter.add).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.any(Function),
          load: expect.any(Function),
        }),
      );
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

describe('ServerExtensionManager — contract & isolation', () => {
  beforeEach(() => {
    serverManager[ACTIVE_EXTENSIONS].clear();
    serverManager[EXTENSION_METADATA].clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuses to load a manifest written for another host version', () => {
    expect(() =>
      // eslint-disable-next-line no-underscore-dangle
      serverManager._assertLoadable('ext', {
        name: 'ext',
        xnapify: { version: '^99.0.0' },
      }),
    ).toThrow(expect.objectContaining({ name: 'IncompatibleExtensionError' }));

    expect(() =>
      // eslint-disable-next-line no-underscore-dangle
      serverManager._assertLoadable('ext', { name: 'ext' }),
    ).toThrow(expect.objectContaining({ code: 'MISSING_HOST_RANGE' }));

    expect(() =>
      // eslint-disable-next-line no-underscore-dangle
      serverManager._assertLoadable('ext', {
        name: 'ext',
        xnapify: { version: '>=0.0.1' },
      }),
    ).not.toThrow();
  });

  it('hands lifecycle hooks a container limited to declared capabilities', async () => {
    const install = jest.fn();
    jest

      .spyOn(serverManager, '_requireApiModule')
      .mockResolvedValue({ install });
    serverManager.apiContainer = {
      has: () => true,
      resolve: name => ({ name }),
      getBindingNames: () => ['db', 'hook', 'jwt', 'worker'],
    };

    await serverManager.installExtension('ext', {
      name: 'ext',
      id: 'ext',
      main: 'api.js',
      xnapify: { version: '>=0.0.1', capabilities: ['hook', 'jwt'] },
    });

    const { container, registry } = install.mock.calls[0][0];
    expect(container.resolve('hook')).toEqual({ name: 'hook' });
    expect(() => container.resolve('db')).toThrow(
      expect.objectContaining({ name: 'CapabilityDeniedError' }),
    );
    // Reserved bindings are never granted, even when declared
    expect(() => container.resolve('jwt')).toThrow(
      expect.objectContaining({ name: 'CapabilityDeniedError' }),
    );
    expect(container.bind).toBeUndefined();
    expect(typeof registry.registerHook).toBe('function');
  });

  it('keeps view activation for the lifetime of the extension', async () => {
    const def = { id: 'ext', shutdown: jest.fn() };
    serverManager[ACTIVE_EXTENSIONS].set('ext', def);
    serverManager.registry.getDefinitions = jest
      .fn()
      .mockReturnValue(new Set([def]));

    await serverManager.deactivateViewNamespace('profile');

    expect(def.shutdown).not.toHaveBeenCalled();
    expect(serverManager[ACTIVE_EXTENSIONS].has('ext')).toBe(true);
  });

  it('checks dependency ranges with semver', () => {
    // eslint-disable-next-line no-underscore-dangle
    expect(serverManager._satisfiesRange('1.4.0', '^1.0.0')).toBe(true);
    // eslint-disable-next-line no-underscore-dangle
    expect(serverManager._satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
  });
});

describe('scopeRouteModule', () => {
  function makeReq(container) {
    const app = {
      settings: { container },
      get(name) {
        return this.settings[name];
      },
    };
    return { app, method: 'POST' };
  }

  const scoped = { resolve: name => `scoped:${name}` };
  const full = { resolve: name => `full:${name}` };

  it('scopes only the final handler of a method export', async () => {
    const seen = {};
    const middleware = (req, _res, next) => {
      seen.middleware = req.app.get('container');
      next();
    };
    const handler = async req => {
      seen.handler = req.app.get('container');
      seen.container = req.container;
      return 'done';
    };
    const mod = scopeRouteModule(
      { post: [middleware, handler], useRateLimit: false },
      () => scoped,
    );

    expect(mod.useRateLimit).toBe(false);
    expect(mod.post).toHaveLength(2);

    const req = makeReq(full);
    mod.post[0](req, {}, () => {});
    expect(seen.middleware).toBe(full);

    const result = await mod.post[1](req, {}, () => {});
    expect(result).toBe('done');
    expect(seen.handler).toBe(scoped);
    expect(seen.container).toBe(scoped);
    // The original app is restored once the handler settles
    expect(req.app.get('container')).toBe(full);
  });

  it('scopes bare function exports and default exports', () => {
    const mod = scopeRouteModule(
      {
        get: req => req.app.get('container'),
        default: req => req.app.get('container'),
      },
      () => scoped,
    );
    expect(mod.get(makeReq(full), {}, () => {})).toBe(scoped);
    expect(mod.default(makeReq(full), {}, () => {})).toBe(scoped);

    const fn = scopeRouteModule(
      req => req.app.get('container'),
      () => scoped,
    );
    expect(fn(makeReq(full), {}, () => {})).toBe(scoped);
  });

  it('restores req.app when the handler throws', () => {
    const mod = scopeRouteModule(
      {
        get: () => {
          throw new Error('boom');
        },
      },
      () => scoped,
    );
    const req = makeReq(full);
    expect(() => mod.get(req, {}, () => {})).toThrow('boom');
    expect(req.app.get('container')).toBe(full);
  });

  it('keeps non-container app settings reachable through the proxy', () => {
    const mod = scopeRouteModule(
      { get: req => req.app.get('env') },
      () => scoped,
    );
    const req = makeReq(full);
    req.app.settings.env = 'test';
    expect(mod.get(req, {}, () => {})).toBe('test');
  });

  it('injects the scoped adapter into API route injection', () => {
    const added = [];
    serverManager.routes.reset();
    // eslint-disable-next-line no-underscore-dangle
    serverManager._connectRouter('api', {
      add: adapter => (added.push(adapter), []),
    });
    serverManager.apiContainer = {
      resolve: name => `full:${name}`,
      has: () => true,
    };
    serverManager[EXTENSION_METADATA].set('ext', {
      manifest: {
        name: 'ext',
        xnapify: { version: '>=0.0.1', capabilities: ['hook'] },
      },
    });

    const routeModule = { get: [req => req.app.get('container')] };
    const adapter = {
      files: () => ['./ext/api/routes/x/_route.js'],
      load: () => routeModule,
    };
    // eslint-disable-next-line no-underscore-dangle
    serverManager._injectRoutes('ext', adapter, 'api');

    expect(added).toHaveLength(1);
    const loaded = added[0].load('./ext/api/routes/x/_route.js');
    const req = makeReq(serverManager.apiContainer);
    const container = loaded.get[0](req, {}, () => {});
    expect(container.resolve('hook')).toBe('full:hook');
    expect(() => container.resolve('db')).toThrow(
      expect.objectContaining({ name: 'CapabilityDeniedError' }),
    );
  });
});
