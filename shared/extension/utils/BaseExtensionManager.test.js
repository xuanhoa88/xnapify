/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import {
  BaseExtensionManager,
  ExtensionState,
  ACTIVE_EXTENSIONS,
  EXTENSION_METADATA,
} from './BaseExtensionManager.js';

// Mock i18n utilities used by translations phase
jest.mock('@shared/i18n/utils', () => ({
  addNamespace: jest.fn(),
  removeNamespace: jest.fn(),
}));
jest.mock('@shared/i18n/loader', () => ({
  getTranslations: jest.fn(ctx => ctx),
}));

// Create mock registry for constructor injection
function createMockRegistry() {
  return {
    defineExtension: jest.fn().mockResolvedValue(true),
    register: jest.fn(),
    unregister: jest.fn(),
    // Part of the unload contract: unregister clears what an extension did,
    // removeDefinition clears what it is. See Registry.removeDefinition.
    removeDefinition: jest.fn(),
    getDefinitions: jest.fn(),
    // Namespace-exact lookup: teardown uses this so it cannot reach the
    // '*' wildcard set that getDefinitions merges into every namespace.
    getOwnDefinitions: jest.fn(),
    has: jest.fn(),
    findDefinition: jest.fn().mockReturnValue(null),
    runInstallHook: jest.fn().mockResolvedValue(true),
    runUninstallHook: jest.fn().mockResolvedValue(true),
  };
}

describe('BaseExtensionManager', () => {
  let manager;
  let mockContext;
  let registry;

  /**
   * Helper: initialize the manager without triggering sync.
   * Sets FETCH internally via init() while skipping sync side-effects.
   */
  async function initManager() {
    manager.fetch = mockContext.fetch;
  }

  beforeEach(() => {
    registry = createMockRegistry();
    manager = new BaseExtensionManager(registry);
    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sync', () => {
    it('fetches extensions and calls loadExtension for each', async () => {
      mockContext.fetch.mockResolvedValue({
        data: {
          extensions: [
            { id: 'extension-1', version: '1.0' },
            'extension-2', // test string format too
          ],
        },
      });

      const loadExtensionSpy = jest
        .spyOn(manager, 'loadExtension')
        .mockResolvedValue();

      manager.fetch = mockContext.fetch;
      await manager.sync();

      expect(mockContext.fetch).toHaveBeenCalledWith('/api/extensions');
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'extension-1',
        expect.any(Object),
      );
      expect(loadExtensionSpy).toHaveBeenCalledWith('extension-2', null);
    });
  });

  describe('loadExtension', () => {
    it('skips if already loaded', async () => {
      manager[ACTIVE_EXTENSIONS].set('existing', {});
      const result = await manager.loadExtension('existing');
      expect(result).toBeDefined();
      expect(mockContext.fetch).not.toHaveBeenCalled();
    });

    it('successfully loads an extension', async () => {
      await initManager();

      mockContext.fetch.mockResolvedValue({
        success: true,
        data: {
          manifest: {
            id: 'test_extension',
            name: 'test-extension',
            main: 'index.js',
          },
        },
      });

      // Mock resolved entry point
      jest.spyOn(manager, '_resolveEntryPoint').mockReturnValue('index.js');

      const mockExtensionInstance = {
        routes: jest.fn(),
      };
      jest
        .spyOn(manager, '_loadExtensionModule')
        .mockResolvedValue(mockExtensionInstance);

      const result = await manager.loadExtension('test-extension');

      expect(result).toBe(mockExtensionInstance);
      expect(registry.defineExtension).toHaveBeenCalledWith(
        mockExtensionInstance,
        null,
        {
          id: 'test_extension',
          name: 'test-extension',
          main: 'index.js',
        },
      );

      const meta = manager[EXTENSION_METADATA].get('test-extension');
      expect(meta.state).toBe(ExtensionState.ACTIVE);
    });

    it('handles load failure', async () => {
      await initManager();

      mockContext.fetch.mockResolvedValue({
        success: false,
        message: 'Not found',
      });

      await manager.loadExtension('fail-extension');

      const meta = manager[EXTENSION_METADATA].get('fail-extension');
      expect(meta.state).toBe(ExtensionState.FAILED);
      expect(meta.error.message).toBe('Not found');
    });
  });

  describe('loadDependencies', () => {
    it('skips loading if all dependencies are already active', async () => {
      await initManager();

      manager[ACTIVE_EXTENSIONS].set('dep-1', {});
      const loadExtensionSpy = jest.spyOn(manager, 'loadExtension');

      await manager.loadDependencies('extension-1', { 'dep-1': '^1.0.0' });

      expect(loadExtensionSpy).not.toHaveBeenCalled();
    });

    it('loads missing dependencies in parallel', async () => {
      await initManager();

      manager[ACTIVE_EXTENSIONS].set('existing-dep', {});
      const loadExtensionSpy = jest
        .spyOn(manager, 'loadExtension')
        .mockImplementation(async id => {
          manager[EXTENSION_METADATA].set(id, {
            id,
            state: ExtensionState.ACTIVE,
            version: '9.0.0',
          });
          return {};
        });

      await manager.loadDependencies('extension-1', {
        'existing-dep': '^1.0.0',
        'missing-dep-1': '^2.0.0',
        'missing-dep-2': '^3.0.0',
      });

      expect(loadExtensionSpy).toHaveBeenCalledTimes(2);
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'missing-dep-1',
        undefined,
        expect.any(Set),
      );
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'missing-dep-2',
        undefined,
        expect.any(Set),
      );
    });

    it('fails when a dependency did not load', async () => {
      await initManager();
      jest.spyOn(manager, 'loadExtension').mockImplementation(async id => {
        manager[EXTENSION_METADATA].set(id, {
          id,
          state: ExtensionState.FAILED,
          error: new Error('boom'),
        });
      });

      await expect(
        manager.loadDependencies('extension-1', { 'broken-dep': '^1.0.0' }),
      ).rejects.toMatchObject({
        name: 'ExtensionDependencyError',
        code: 'EXTENSION_DEPENDENCY_MISSING',
      });
    });

    it('fails when a loaded dependency does not satisfy the range', async () => {
      await initManager();
      manager[ACTIVE_EXTENSIONS].set('dep-1', {});
      manager[EXTENSION_METADATA].set('dep-1', {
        id: 'dep-1',
        state: ExtensionState.ACTIVE,
        version: '1.0.0',
      });

      jest.spyOn(manager, '_satisfiesRange').mockReturnValue(false);

      await expect(
        manager.loadDependencies('extension-1', { 'dep-1': '^2.0.0' }),
      ).rejects.toMatchObject({ code: 'EXTENSION_DEPENDENCY_VERSION' });
    });
  });

  describe('_postLoad', () => {
    it('boots every definition once at load, module-type included', async () => {
      await initManager();
      const boot = jest.fn();
      const def = { id: 'mod-1', boot, routes: () => null };
      registry.findDefinition.mockReturnValue(def);

      // eslint-disable-next-line no-underscore-dangle
      await manager._postLoad('mod-1', def, { slots: [] });

      expect(boot).toHaveBeenCalledTimes(1);
      expect(boot).toHaveBeenCalledWith(
        expect.objectContaining({ registry: expect.any(Object) }),
      );
      expect(registry.register).toHaveBeenCalledWith('mod-1', def);
      expect(manager[ACTIVE_EXTENSIONS].has('mod-1')).toBe(true);

      // A later namespace activation must not boot it again
      registry.getDefinitions.mockReturnValue(new Set([def]));
      await manager.activateViewNamespace('*');
      expect(boot).toHaveBeenCalledTimes(1);
    });
  });

  describe('menus hook', () => {
    it("runs an extension's menus hook, before boot", async () => {
      await initManager();
      manager.viewContext = { store: { dispatch: jest.fn() } };
      const order = [];
      const def = {
        id: 'mod-menus',
        providers: jest.fn(() => order.push('providers')),
        menus: jest.fn(() => order.push('menus')),
        boot: jest.fn(() => order.push('boot')),
      };
      registry.findDefinition.mockReturnValue(def);

      // eslint-disable-next-line no-underscore-dangle
      await manager._postLoad('mod-menus', def, { slots: [] });

      // `menus` is listed in VIEW_LIFECYCLE_PHASES, so an extension that
      // declares one has to get it run — it used to be silently skipped.
      expect(def.menus).toHaveBeenCalledTimes(1);
      expect(def.menus).toHaveBeenCalledWith(
        expect.objectContaining({ registry: expect.any(Object) }),
      );
      expect(order).toEqual(['providers', 'menus', 'boot']);
    });

    it('hands the menus hook a context it can dispatch from', async () => {
      await initManager();
      const store = { dispatch: jest.fn() };
      const i18n = { t: (_k, fallback) => fallback };
      manager.viewContext = { store, i18n };

      const def = { id: 'mod-ctx', menus: jest.fn() };
      registry.findDefinition.mockReturnValue(def);

      // eslint-disable-next-line no-underscore-dangle
      await manager._postLoad('mod-ctx', def, { slots: [] });

      // Registering a sidebar entry means dispatching registerMenu, so the
      // hook is useless without the store and the translator. Extensions used
      // to get `{ container, registry }` only.
      const [ctx] = def.menus.mock.calls[0];
      expect(ctx.store).toBe(store);
      expect(ctx.i18n).toBe(i18n);
      expect(ctx.container).toBeDefined();
      expect(ctx.registry).toBeDefined();
    });

    it('skips menus when the context has no store to dispatch into', async () => {
      // The server never sets viewContext — its store is per request — so
      // activating there used to call menus({ store: undefined }) and throw
      // "Cannot read properties of undefined (reading 'dispatch')". The
      // request-scoped runViewMenus() is what covers the server.
      await initManager();
      expect(manager.viewContext).toBeNull();

      const boot = jest.fn();
      const menus = jest.fn(({ store }) => store.dispatch({}));
      const def = { id: 'mod-no-store', menus, boot };
      registry.findDefinition.mockReturnValue(def);

      // eslint-disable-next-line no-underscore-dangle
      await manager._postLoad('mod-no-store', def, { slots: [] });

      expect(menus).not.toHaveBeenCalled();
      expect(boot).toHaveBeenCalledTimes(1);
      expect(manager[ACTIVE_EXTENSIONS].has('mod-no-store')).toBe(true);

      // ...and the same extension still gets its menu once a store shows up.
      const store = { dispatch: jest.fn() };
      expect(await manager.runViewMenus({ store })).toBe(1);
      expect(menus).toHaveBeenCalledTimes(1);
    });

    it('does not let a failing menus hook stop the extension booting', async () => {
      await initManager();
      manager.viewContext = { store: { dispatch: jest.fn() } };
      const boot = jest.fn();
      const def = {
        id: 'mod-bad-menus',
        menus: jest.fn(() => {
          throw new Error('bad menu');
        }),
        boot,
      };
      registry.findDefinition.mockReturnValue(def);

      // eslint-disable-next-line no-underscore-dangle
      await manager._postLoad('mod-bad-menus', def, { slots: [] });

      expect(boot).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivateViewNamespace', () => {
    it('never tears down an always-on extension', async () => {
      await initManager();
      // `getDefinitions` merges the '*' set into every namespace so that
      // activation covers always-on extensions wherever the user navigates.
      // Teardown must not inherit that: leaving one route's namespace would
      // otherwise shut down an extension that lives on every page.
      const wildcard = { id: 'always-on', shutdown: jest.fn() };
      const scoped = { id: 'login-only', shutdown: jest.fn() };
      manager[ACTIVE_EXTENSIONS].set('always-on', wildcard);
      manager[ACTIVE_EXTENSIONS].set('login-only', scoped);

      // getOwnDefinitions returns the namespace's own set; getDefinitions
      // would have returned both.
      registry.getOwnDefinitions.mockReturnValue(new Set([scoped]));
      registry.getDefinitions.mockReturnValue(new Set([scoped, wildcard]));

      await manager.deactivateViewNamespace('login');

      expect(scoped.shutdown).toHaveBeenCalledTimes(1);
      expect(wildcard.shutdown).not.toHaveBeenCalled();
      expect(manager[ACTIVE_EXTENSIONS].has('always-on')).toBe(true);
    });
  });

  describe('getLoadableManifests', () => {
    it('does not offer the browser an extension the server tore down', async () => {
      await initManager();
      // unloadExtension leaves the metadata behind (state UNLOADED) so a
      // later reload can reuse it. Serialising that raw map into the SSR
      // payload handed the browser a deactivated extension, which fetched
      // its bundle and re-registered its menus one hydration later.
      manager[EXTENSION_METADATA].set('live', {
        state: ExtensionState.ACTIVE,
        manifest: { id: 'live' },
      });
      manager[EXTENSION_METADATA].set('no-entry-point', {
        state: ExtensionState.LOADED,
        manifest: { id: 'no-entry-point' },
      });
      manager[EXTENSION_METADATA].set('deactivated', {
        state: ExtensionState.UNLOADED,
        manifest: { id: 'deactivated' },
      });
      manager[EXTENSION_METADATA].set('broken', {
        state: ExtensionState.FAILED,
        manifest: null,
      });

      // LOADED stays: an extension with neither `browser` nor `main` never
      // reaches ACTIVE yet is perfectly live.
      expect(manager.getLoadableManifests().map(m => m.id)).toEqual([
        'live',
        'no-entry-point',
      ]);
    });
  });

  describe('runViewMenus', () => {
    it('re-runs every active extension menus hook against a given context', async () => {
      await initManager();
      const menus = jest.fn();
      manager[ACTIVE_EXTENSIONS].set('mod-a', { id: 'mod-a', menus });
      manager[ACTIVE_EXTENSIONS].set('mod-b', { id: 'mod-b' });

      const context = { store: { dispatch: jest.fn() }, i18n: { t: x => x } };
      const ran = await manager.runViewMenus(context);

      expect(ran).toBe(1);
      const [ctx] = menus.mock.calls[0];
      expect(ctx.store).toBe(context.store);
      expect(ctx.i18n).toBe(context.i18n);
      expect(ctx.registry).toBeDefined();
    });

    it('hands the menus hook the extension-scoped container', async () => {
      // menus was the one view phase that skipped _hookContextFor, so on the
      // server it ran with the unscoped API container — on every page.
      await initManager();
      const menus = jest.fn();
      manager[ACTIVE_EXTENSIONS].set('mod-a', { id: 'mod-a', menus });
      jest

        .spyOn(manager, '_hookContextFor')
        .mockImplementation(id => ({ container: `scoped:${id}` }));

      const context = { store: { dispatch: jest.fn() }, container: 'FULL' };
      await manager.runViewMenus(context);

      const [ctx] = menus.mock.calls[0];
      // eslint-disable-next-line no-underscore-dangle
      expect(manager._hookContextFor).toHaveBeenCalledWith('mod-a');
      expect(ctx.container).toBe('scoped:mod-a');
      expect(ctx.store).toBe(context.store);
    });

    it('does nothing without a store to dispatch into', async () => {
      await initManager();
      const menus = jest.fn();
      manager[ACTIVE_EXTENSIONS].set('mod-a', { id: 'mod-a', menus });

      expect(await manager.runViewMenus(undefined)).toBe(0);
      expect(await manager.runViewMenus({ i18n: {} })).toBe(0);
      expect(menus).not.toHaveBeenCalled();
    });

    it('keeps going when one extension menus hook throws', async () => {
      await initManager();
      const good = jest.fn();
      manager[ACTIVE_EXTENSIONS].set('bad', {
        id: 'bad',
        menus: () => {
          throw new Error('nope');
        },
      });
      manager[ACTIVE_EXTENSIONS].set('good', { id: 'good', menus: good });

      expect(await manager.runViewMenus({ store: {} })).toBe(1);
      expect(good).toHaveBeenCalledTimes(1);
    });
  });

  describe('capability-scoped load path', () => {
    it('stores the scoped context on the definition', async () => {
      // def.context is handed to install()/uninstall() by the registry, so it
      // must be the scoped container, not the host's own.
      await initManager();
      mockContext.fetch.mockResolvedValue({
        success: true,
        data: { manifest: { id: 'ext', name: 'ext', main: 'index.js' } },
      });
      jest.spyOn(manager, '_resolveEntryPoint').mockReturnValue('index.js');
      jest
        .spyOn(manager, '_loadExtensionModule')
        .mockResolvedValue({ boot: jest.fn() });
      jest

        .spyOn(manager, '_hookContextFor')
        .mockImplementation(id => ({ container: `scoped:${id}` }));

      await manager.loadExtension('ext');

      expect(registry.defineExtension).toHaveBeenCalledWith(
        expect.any(Object),
        'scoped:ext',
        expect.objectContaining({ id: 'ext' }),
      );
    });

    it('publishes the manifest before the post-load lifecycle runs', async () => {
      // On the API-resolved path (targeted refresh after install/update) the
      // metadata manifest stayed null until the very end, so every hook run
      // from _postLoad saw an empty manifest — i.e. default capabilities only.
      await initManager();
      const manifest = {
        id: 'ext',
        name: 'ext',
        main: 'index.js',
        xnapify: { capabilities: ['db'] },
      };
      mockContext.fetch.mockResolvedValue({
        success: true,
        data: { manifest },
      });
      jest.spyOn(manager, '_resolveEntryPoint').mockReturnValue('index.js');
      jest
        .spyOn(manager, '_loadExtensionModule')
        .mockResolvedValue({ boot: jest.fn() });

      let seen;

      jest.spyOn(manager, '_postLoad').mockImplementation(async id => {
        seen = manager[EXTENSION_METADATA].get(id).manifest;
      });

      await manager.loadExtension('ext');

      expect(seen).toEqual(manifest);
    });
  });

  describe('destroy', () => {
    it('lets go of the route table and the render context', async () => {
      await initManager();
      manager.viewContext = { store: {}, i18n: {}, history: {} };
      manager.routes.connect('views', { add: () => [] });
      manager.routes.buffered.push({ id: 'ext', routerKey: 'views' });

      await manager.destroy();

      expect(manager.viewContext).toBeNull();
      expect(manager.routes.routers.views).toBeNull();
      expect(manager.routes.buffered).toHaveLength(0);
    });
  });

  describe('_scopedRegistry', () => {
    it("refuses to unregister another extension's registrations", () => {
      const real = {
        registerSlot: jest.fn(),
        registerHook: jest.fn(),
        unregisterSlot: jest.fn(),
        unregisterHook: jest.fn(),
        ownsSlot: jest.fn((ext, slot) => slot === 'mine'),
        ownsHook: jest.fn((ext, hook) => hook === 'mine'),
      };
      const scopedManager = new BaseExtensionManager(real);
      // eslint-disable-next-line no-underscore-dangle
      const scoped = scopedManager._scopedRegistry('ext-a');
      const fn = () => {};

      scoped.unregisterSlot('theirs', fn);
      scoped.unregisterHook('theirs', fn);
      expect(real.unregisterSlot).not.toHaveBeenCalled();
      expect(real.unregisterHook).not.toHaveBeenCalled();

      scoped.unregisterSlot('mine', fn);
      scoped.unregisterHook('mine', fn);
      expect(real.unregisterSlot).toHaveBeenCalledWith('mine', fn);
      expect(real.unregisterHook).toHaveBeenCalledWith('mine', fn);

      scoped.registerSlot('s', fn, { order: 2 });
      expect(real.registerSlot).toHaveBeenCalledWith('s', fn, {
        order: 2,
        extensionId: 'ext-a',
      });
      scoped.registerHook('h', fn, { public: true });
      expect(real.registerHook).toHaveBeenCalledWith('h', fn, 'ext-a', {
        public: true,
      });
    });
  });

  describe('unloadExtension', () => {
    it('unregisters extension from registry', async () => {
      await initManager();

      const mockExtension = {};
      manager[ACTIVE_EXTENSIONS].set('p1', mockExtension);
      manager[EXTENSION_METADATA].set('p1', { state: ExtensionState.LOADED });

      await manager.unloadExtension('p1');

      expect(registry.unregister).toHaveBeenCalledWith('p1');
      expect(manager[ACTIVE_EXTENSIONS].has('p1')).toBe(false);
      expect(manager[EXTENSION_METADATA].get('p1').state).toBe(
        ExtensionState.UNLOADED,
      );
    });
  });

  describe('activateViewNamespace', () => {
    it('activates extensions for a namespace', async () => {
      await initManager();

      const mockDef = { id: 'p1', boot: jest.fn() };
      registry.getDefinitions.mockReturnValue(new Set([mockDef]));

      await manager.activateViewNamespace('ui');

      expect(registry.register).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ id: 'p1' }),
      );
      expect(manager[ACTIVE_EXTENSIONS].has('p1')).toBe(true);

      // Verify boot wrapper — pass a context object as Registry now does
      const registeredInstance = registry.register.mock.calls[0][1];
      const mockContext = { registry, container: {} };
      await registeredInstance.boot(mockContext);
      expect(mockDef.boot).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('uninstallExtension', () => {
    it('rejects uninstall on active extension', async () => {
      await initManager();
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate an active extension
      manager[EXTENSION_METADATA].set('active-ext', {
        id: 'active-ext',
        state: ExtensionState.ACTIVE,
        manifest: { name: 'active-ext' },
      });

      const result = await manager.uninstallExtension('active-ext', {
        name: 'active-ext',
      });

      expect(result).toBe(false);
    });

    it('allows uninstall on non-active extension', async () => {
      await initManager();

      // Simulate an unloaded extension
      manager[EXTENSION_METADATA].set('inactive-ext', {
        id: 'inactive-ext',
        state: ExtensionState.UNLOADED,
        manifest: { name: 'inactive-ext' },
      });

      const result = await manager.uninstallExtension('inactive-ext', {
        name: 'inactive-ext',
      });

      expect(result).toBe(true);
      expect(registry.runUninstallHook).toHaveBeenCalledWith('inactive-ext');
    });

    it('allows uninstall when no metadata exists', async () => {
      await initManager();

      const result = await manager.uninstallExtension('unknown-ext', {
        name: 'unknown-ext',
      });

      expect(result).toBe(true);
    });
  });

  describe('installExtension', () => {
    it('rejects install on already-loaded extension', async () => {
      await initManager();
      jest.spyOn(console, 'error').mockImplementation(() => {});

      manager[EXTENSION_METADATA].set('dup-ext', {
        id: 'dup-ext',
        state: ExtensionState.LOADED,
        manifest: { name: 'dup-ext' },
      });

      const result = await manager.installExtension('dup-ext', {
        name: 'dup-ext',
      });

      expect(result).toBe(false);
    });

    it('rejects install on active extension', async () => {
      await initManager();
      jest.spyOn(console, 'error').mockImplementation(() => {});

      manager[EXTENSION_METADATA].set('active-ext', {
        id: 'active-ext',
        state: ExtensionState.ACTIVE,
        manifest: { name: 'active-ext' },
      });

      const result = await manager.installExtension('active-ext', {
        name: 'active-ext',
      });

      expect(result).toBe(false);
    });

    it('allows install on pending (fresh) extension', async () => {
      await initManager();

      manager[EXTENSION_METADATA].set('new-ext', {
        id: 'new-ext',
        state: ExtensionState.PENDING,
      });

      const result = await manager.installExtension('new-ext', {
        name: 'new-ext',
      });

      expect(result).toBe(true);
      expect(registry.runInstallHook).toHaveBeenCalledWith('new-ext');
    });

    it('allows install when no metadata exists', async () => {
      await initManager();

      const result = await manager.installExtension('fresh-ext', {
        name: 'fresh-ext',
      });

      expect(result).toBe(true);
    });
  });
});
