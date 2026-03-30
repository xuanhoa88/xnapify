/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import ExtensionRegistry from './Registry';

describe('ExtensionRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Extension Management', () => {
    test('registers an extension and stores it', () => {
      const ext = { name: 'Test Extension', boot: jest.fn() };

      registry.register('extension-1', ext);

      expect(registry.has('extension-1')).toBe(true);
      expect(registry.get('extension-1')).toMatchObject({
        id: 'extension-1',
        name: 'Test Extension',
      });
      expect(registry.list()).toContain('extension-1');
      // boot is NOT called — lifecycle is owned by activateViewNamespace
      expect(ext.boot).not.toHaveBeenCalled();
    });

    test('unregisters an extension and removes it', () => {
      const shutdown = jest.fn();
      const ext = { name: 'Test Extension', shutdown };

      registry.register('extension-1', ext);
      registry.unregister('extension-1');

      expect(registry.has('extension-1')).toBe(false);
      // shutdown is NOT called — lifecycle is owned by deactivateViewNamespace
      expect(shutdown).not.toHaveBeenCalled();
    });

    test('unregister clears extension slots and hooks', async () => {
      await registry.register('extension-1', {});

      const component = () => null;
      registry.registerSlot('header', component, {
        extensionId: 'extension-1',
      });
      registry.registerHook('test.hook', () => {}, 'extension-1');

      expect(registry.getSlotEntries('header')).toHaveLength(1);

      await registry.unregister('extension-1');

      expect(registry.getSlotEntries('header')).toHaveLength(0);
    });
  });

  describe('Definitions', () => {
    test('defines and finds extension definitions', () => {
      const definition = { init: jest.fn() };
      const manifest = {
        name: 'extension-1',
        description: 'Test',
        slots: ['core'],
      };

      registry.defineExtension(definition, { appContext: true }, manifest);
      const def = registry.findDefinition('extension-1');

      expect(def).toBeDefined();
      expect(def.id).toBe('extension-1');
      expect(registry.getDefinitions('core').size).toBe(1);
    });

    test('can define multiple namespaces via slots', () => {
      const definition = { init: jest.fn() };
      const manifest = {
        name: 'extension-multi-ns',
        slots: ['core', 'ui'],
      };

      registry.defineExtension(definition, {}, manifest);

      expect(registry.getDefinitions('core').size).toBe(1);
      expect(registry.getDefinitions('ui').size).toBe(1);
      expect(registry.findDefinition('extension-multi-ns')).toBeDefined();
    });

    test('installs an extension by ID', async () => {
      const install = jest.fn().mockResolvedValue();
      const definition = { install };
      const manifest = {
        name: 'extension-to-install',
        slots: ['core'],
      };

      registry.defineExtension(definition, { contextVal: 42 }, manifest);
      const result = await registry.runInstallHook('extension-to-install');

      expect(result).toBe(true);
      expect(install).toHaveBeenCalledWith({ contextVal: 42 });
    });

    test('uninstalls an extension by ID', async () => {
      const uninstall = jest.fn().mockResolvedValue();
      const definition = { uninstall };
      const manifest = {
        name: 'extension-to-uninstall',
        slots: ['core'],
      };

      registry.defineExtension(definition, { contextVal: 42 }, manifest);
      const result = await registry.runUninstallHook('extension-to-uninstall');

      expect(result).toBe(true);
      expect(uninstall).toHaveBeenCalledWith({ contextVal: 42 });
    });

    test('updates an extension by ID', async () => {
      const boot = jest.fn();
      const shutdown = jest.fn();

      // Initial mock extension already registered
      registry.register('extension-updatable', { shutdown });

      const definition = { boot };
      const manifest = {
        name: 'extension-updatable',
        slots: ['core'],
      };

      registry.defineExtension(definition, { contextVal: 42 }, manifest);

      const result = await registry.runUpdateHook('extension-updatable');

      // runUpdateHook stores the new definition (pure-store)
      expect(result).toBe(registry);
      expect(registry.has('extension-updatable')).toBe(true);
    });

    test('module-type without slots auto-subscribes to wildcard', () => {
      const definition = { routes: jest.fn() };
      const manifest = {
        name: 'posts-module',
        browser: 'views/index.js',
        main: 'api/index.js',
      };

      registry.defineExtension(definition, {}, manifest);

      // Should be stored under '*' namespace
      expect(registry.getDefinitions('*').size).toBe(1);
      expect(registry.findDefinition('posts-module')).toBeDefined();
    });

    test('getDefinitions includes wildcard definitions for any namespace', () => {
      // Define a wildcard module
      registry.defineExtension(
        { routes: jest.fn() },
        {},
        { name: 'global-mod', browser: 'index.js' },
      );

      // Define a namespace-specific extension
      registry.defineExtension(
        { init: jest.fn() },
        {},
        { name: 'core-ext', slots: ['core'] },
      );

      // Querying 'core' should return both core-ext AND global-mod
      const coreDefs = registry.getDefinitions('core');
      expect(coreDefs.size).toBe(2);

      const ids = [...coreDefs].map(d => d.id);
      expect(ids).toContain('core-ext');
      expect(ids).toContain('global-mod');

      // Querying unknown namespace should still return wildcard
      const otherDefs = registry.getDefinitions('unknown-ns');
      expect(otherDefs.size).toBe(1);
      expect([...otherDefs][0].id).toBe('global-mod');
    });

    test('explicit slots is preserved for module-type', () => {
      const definition = { routes: jest.fn() };
      const manifest = {
        name: 'scoped-mod',
        browser: 'index.js',
        slots: ['admin'],
      };

      registry.defineExtension(definition, {}, manifest);

      // Should be stored under 'admin', NOT under '*'
      expect(registry.getDefinitions('admin').size).toBe(1);
      expect(registry.getDefinitions('*')).toBeNull();
    });

    test('API-only with routes() auto-subscribes to wildcard', () => {
      const definition = { init: jest.fn(), routes: jest.fn() };
      const manifest = {
        name: 'api-module',
        main: 'api/index.js',
      };

      registry.defineExtension(definition, {}, manifest);

      // Now all modules with routes() auto-subscribe to wildcard
      expect(registry.getDefinitions('*').size).toBe(1);
    });

    test('extension without routes is plugin', () => {
      const definition = { init: jest.fn() };
      const manifest = {
        name: 'hook-plugin',
        slots: ['core'],
      };

      registry.defineExtension(definition, {}, manifest);

      expect(registry.getDefinitions('core').size).toBe(1);
      expect(registry.getDefinitions('*')).toBeNull();
    });

    test('runInstallHook returns false for unknown extension', async () => {
      const result = await registry.runInstallHook('nonexistent');
      expect(result).toBe(false);
    });

    test('runUninstallHook returns false for unknown extension', async () => {
      const result = await registry.runUninstallHook('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Slots', () => {
    test('registers and gets slot components ordered', () => {
      const comp1 = () => null;
      const comp2 = () => null;

      registry.registerSlot('test.slot', comp2, { order: 20 });
      registry.registerSlot('test.slot', comp1, { order: 10 });

      const slots = registry.getSlotEntries('test.slot');

      expect(slots).toHaveLength(2);
      expect(slots[0].component).toBe(comp1);
      expect(slots[1].component).toBe(comp2);
    });

    test('unregisters slot components', () => {
      const comp = () => null;
      registry.registerSlot('test.slot', comp);
      registry.unregisterSlot('test.slot', comp);

      expect(registry.getSlotEntries('test.slot')).toHaveLength(0);
    });
  });

  describe('Hooks', () => {
    test('registers and executes hooks', async () => {
      const hookCb = jest.fn().mockReturnValue('result');
      registry.registerHook('test.action', hookCb);

      const res = await registry.executeHook('test.action', 'arg1');

      expect(hookCb).toHaveBeenCalledWith('arg1');
      expect(res).toEqual(['result']);
    });
  });

  describe('Subscriptions', () => {
    test('notifies subscribers on registry changes', () => {
      const listener = jest.fn();
      const unsubscribe = registry.subscribe(listener);

      registry.registerSlot('ui.header', () => null);

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      registry.registerSlot('ui.footer', () => null);

      expect(listener).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('Pipelines', () => {
    test('creates a pipeline and executes middlewares in order', async () => {
      const step1 = jest.fn((data, ctx, next) => {
        data.order.push(1);
        return next();
      });
      const step2 = jest.fn((data, ctx, next) => {
        data.order.push(2);
        return next();
      });

      const pipeline = registry.createPipeline(step1, step2);
      const data = { order: [] };
      const ctx = { some: 'ctx' };

      await pipeline(data, ctx);

      expect(data.order).toEqual([1, 2]);
      expect(step1).toHaveBeenCalledWith(data, ctx, expect.any(Function));
      expect(step2).toHaveBeenCalledWith(data, ctx, expect.any(Function));
    });

    test('supports short-circuiting in pipeline', async () => {
      const step1 = jest.fn((data, _ctx, _next) => {
        data.called = true;
        // Not calling next()
        return 'short-circuit';
      });
      const step2 = jest.fn();

      const pipeline = registry.createPipeline(step1, step2);
      const data = {};

      const result = await pipeline(data, {});

      expect(data.called).toBe(true);
      expect(step2).not.toHaveBeenCalled();
      expect(result).toBe('short-circuit');
    });

    test('passes data modifications through the pipeline', async () => {
      const step1 = (data, _ctx, next) => {
        data.value += 10;
        return next();
      };
      const step2 = (data, _ctx, next) => {
        data.value *= 2;
        return next();
      };

      const pipeline = registry.createPipeline(step1, step2);
      const data = { value: 5 };

      await pipeline(data, {});

      expect(data.value).toBe(30); // (5 + 10) * 2
    });
  });
});
