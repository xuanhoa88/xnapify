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
    getDefinitions: jest.fn(),
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
