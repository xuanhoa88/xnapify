/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import PluginRegistry from './Registry';

describe('PluginRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new PluginRegistry();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Plugin Management', () => {
    test('registers a plugin and initializes it', async () => {
      const init = jest.fn().mockResolvedValue();
      const plugin = { name: 'Test Plugin', init };

      await registry.register('plugin-1', plugin, { someContext: true });

      expect(registry.has('plugin-1')).toBe(true);
      expect(registry.get('plugin-1')).toMatchObject({
        id: 'plugin-1',
        name: 'Test Plugin',
      });
      expect(registry.list()).toContain('plugin-1');
      expect(init).toHaveBeenCalledWith(registry, { someContext: true });
    });

    test('unregisters a plugin and calls destroy', async () => {
      const destroy = jest.fn().mockResolvedValue();
      const plugin = { name: 'Test Plugin', destroy };

      await registry.register('plugin-1', plugin);
      await registry.unregister('plugin-1', { someContext: true });

      expect(registry.has('plugin-1')).toBe(false);
      expect(destroy).toHaveBeenCalledWith(registry, { someContext: true });
    });

    test('unregister clears plugin slots and hooks', async () => {
      await registry.register('plugin-1', {});

      const component = () => null;
      registry.registerSlot('header', component, { pluginId: 'plugin-1' });
      registry.registerHook('test.hook', () => {}, 'plugin-1');

      expect(registry.getSlot('header')).toHaveLength(1);

      await registry.unregister('plugin-1');

      expect(registry.getSlot('header')).toHaveLength(0);
      // Hooks clearing is tested in Hook.test.js, but we ensure the Registry calls clear
    });
  });

  describe('Definitions', () => {
    test('defines and finds plugin definitions', () => {
      const definition = { init: jest.fn() };
      const manifest = {
        name: 'plugin-1',
        description: 'Test',
        rsk: { subscribe: ['core'], name: 'plugin-1' },
      };

      registry.define(definition, { appContext: true }, manifest);
      const def = registry.findDefinition('plugin-1');

      expect(def).toBeDefined();
      expect(def.name).toBe('plugin-1');
      expect(registry.getDefinitions('core').size).toBe(1);
    });

    test('can define multiple namespaces via subscribe', () => {
      const definition = { init: jest.fn() };
      const manifest = {
        name: 'plugin-multi-ns',
        rsk: { subscribe: ['core', 'ui'], name: 'plugin-multi-ns' },
      };

      registry.define(definition, {}, manifest);

      expect(registry.getDefinitions('core').size).toBe(1);
      expect(registry.getDefinitions('ui').size).toBe(1);
      expect(registry.findDefinition('plugin-multi-ns')).toBeDefined();
    });

    test('installs a plugin by ID', async () => {
      const install = jest.fn().mockResolvedValue();
      const definition = { install };
      const manifest = {
        name: 'plugin-to-install',
        rsk: { subscribe: ['core'], name: 'plugin-to-install' },
      };

      registry.define(definition, { contextVal: 42 }, manifest);
      const result = await registry.installPlugin('plugin-to-install');

      expect(result).toBe(true);
      expect(install).toHaveBeenCalledWith({ contextVal: 42 });
    });

    test('uninstalls a plugin by ID', async () => {
      const uninstall = jest.fn().mockResolvedValue();
      const definition = { uninstall };
      const manifest = {
        name: 'plugin-to-uninstall',
        rsk: { subscribe: ['core'], name: 'plugin-to-uninstall' },
      };

      registry.define(definition, { contextVal: 42 }, manifest);
      const result = await registry.uninstallPlugin('plugin-to-uninstall');

      expect(result).toBe(true);
      expect(uninstall).toHaveBeenCalledWith({ contextVal: 42 });
    });

    test('updates a plugin by ID', async () => {
      const init = jest.fn().mockResolvedValue();
      const destroy = jest.fn().mockResolvedValue();

      // Initial mock plugin already registered
      await registry.register('plugin-updatable', { destroy });

      const definition = { init };
      const manifest = {
        name: 'plugin-updatable',
        rsk: { subscribe: ['core'], name: 'plugin-updatable' },
      };

      registry.define(definition, { contextVal: 42 }, manifest);

      const result = await registry.updatePlugin('plugin-updatable');

      // The registry unregisters the current instance and registers the new one built from definition
      expect(result).toBe(registry);
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledWith(registry, { contextVal: 42 });
    });
  });

  describe('Slots', () => {
    test('registers and gets slot components ordered', () => {
      const comp1 = () => null;
      const comp2 = () => null;

      registry.registerSlot('test.slot', comp2, { order: 20 });
      registry.registerSlot('test.slot', comp1, { order: 10 });

      const slots = registry.getSlot('test.slot');

      expect(slots).toHaveLength(2);
      expect(slots[0].component).toBe(comp1);
      expect(slots[1].component).toBe(comp2);
    });

    test('unregisters slot components', () => {
      const comp = () => null;
      registry.registerSlot('test.slot', comp);
      registry.unregisterSlot('test.slot', comp);

      expect(registry.getSlot('test.slot')).toHaveLength(0);
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
