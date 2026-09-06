/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ExtensionRegistry from './Registry.js';
import {
  HandlerOwnershipError,
  PASSTHROUGH_METHODS,
  bindPassthrough,
  createScopedRegistry,
} from './scopedRegistry.js';

describe('createScopedRegistry guards', () => {
  it('requires a registry and an extension id', () => {
    expect(() => createScopedRegistry(null, 'ext-a')).toThrow(TypeError);
    expect(() => createScopedRegistry(new ExtensionRegistry(), '')).toThrow(
      TypeError,
    );
  });
});

describe('createScopedRegistry identity injection', () => {
  let registry;
  let scoped;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    scoped = createScopedRegistry(registry, 'ext-a');
  });

  it('tags hook registrations with the owning extension', () => {
    const callback = () => 1;
    scoped.registerHook('h', callback);
    expect(registry.ownsHook('ext-a', 'h', callback)).toBe(true);
    expect(registry.ownsHook('ext-b', 'h', callback)).toBe(false);
  });

  it('tags handler registrations with the owning extension', () => {
    scoped.registerHandler('ipc:ext-a:ping', () => 'pong');
    expect(registry.ownsHandler('ext-a', 'ipc:ext-a:ping')).toBe(true);
  });

  it('forwards the public opt-in for handlers', () => {
    scoped.registerHandler('ipc:ext-a:ping', () => 'pong', { public: true });
    expect(registry.getHandlerMeta('ipc:ext-a:ping')).toEqual({ public: true });
  });

  it('refuses an ipc handler id addressed to another extension', () => {
    // The gateway builds `ipc:<url id>:<action>`, so registering under
    // someone else's prefix either answers their callers or — because a
    // second claim throws DuplicateHandlerError inside boot() — stops them
    // from ever mounting.
    expect(() => scoped.registerHandler('ipc:ext-b:doThing', () => 1)).toThrow(
      HandlerOwnershipError,
    );
    expect(registry.hasHandler('ipc:ext-b:doThing')).toBe(false);

    try {
      scoped.registerHandler('ipc:ext-b:doThing', () => 1);
    } catch (err) {
      expect(err.code).toBe('E_HANDLER_NOT_OWNED');
      expect(err.status).toBe(403);
      expect(err.extensionId).toBe('ext-a');
    }
  });

  it('refuses an id that only looks like its own prefix', () => {
    expect(() =>
      scoped.registerHandler('ipc:ext-a-evil:doThing', () => 1),
    ).toThrow(HandlerOwnershipError);
  });

  it('leaves non-ipc handler ids alone', () => {
    scoped.registerHandler('reports:render', () => 'ok');
    expect(registry.ownsHandler('ext-a', 'reports:render')).toBe(true);
  });

  it('tags slot registrations with the owning extension', () => {
    const component = () => null;
    scoped.registerSlot('sidebar', component);
    expect(registry.ownsSlot('ext-a', 'sidebar', component)).toBe(true);
  });
});

describe('createScopedRegistry removal is limited to its own registrations', () => {
  let registry;
  let scopedA;
  let scopedB;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    scopedA = createScopedRegistry(registry, 'ext-a');
    scopedB = createScopedRegistry(registry, 'ext-b');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('refuses to unregister another extension hook', () => {
    const callback = () => 1;
    scopedA.registerHook('h', callback);

    scopedB.unregisterHook('h', callback);

    expect(registry.hasHook('h')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('does not own'),
    );
  });

  it('refuses to unregister another extension handler', () => {
    scopedA.registerHandler('ipc:ext-a:ping', () => 'pong');

    scopedB.unregisterHandler('ipc:ext-a:ping');

    expect(registry.hasHandler('ipc:ext-a:ping')).toBe(true);
  });

  it('refuses to unregister another extension slot', () => {
    const component = () => null;
    scopedA.registerSlot('sidebar', component);

    scopedB.unregisterSlot('sidebar', component);

    expect(registry.getSlotEntries('sidebar')).toHaveLength(1);
  });

  it('removes its own registrations', () => {
    const callback = () => 1;
    scopedA.registerHook('h', callback);
    scopedA.registerHandler('ipc:ext-a:ping', () => 'pong');

    scopedA.unregisterHook('h', callback);
    scopedA.unregisterHandler('ipc:ext-a:ping');

    expect(registry.hasHook('h')).toBe(false);
    expect(registry.hasHandler('ipc:ext-a:ping')).toBe(false);
  });

  it('warns instead of doing nothing when a hook removal omits the callback', () => {
    // Removing by id alone cannot identify which callback to drop. It used to
    // return quietly, so extension shutdown code read as cleanup that worked.
    scopedA.registerHook('h', () => 1);

    scopedA.unregisterHook('h');

    expect(registry.hasHook('h')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('without the callback'),
    );
  });
});

describe('createScopedRegistry passthrough', () => {
  it('forwards read and execute methods to the shared registry', async () => {
    const registry = new ExtensionRegistry();
    const scoped = createScopedRegistry(registry, 'ext-a');

    scoped.registerHook('h', () => 'contribution');
    scoped.registerHandler('ipc:ext-a:ping', () => 'pong');

    await expect(scoped.executeHook('h')).resolves.toEqual(['contribution']);
    await expect(scoped.invokeHandler('ipc:ext-a:ping')).resolves.toMatchObject(
      { handled: true, value: 'pong' },
    );
    expect(scoped.hasHook('h')).toBe(true);
    expect(scoped.hasHandler('ipc:ext-a:ping')).toBe(true);
  });

  it('does not expose registry internals that would defeat scoping', () => {
    const registry = new ExtensionRegistry();
    const scoped = createScopedRegistry(registry, 'ext-a');

    // `clear` would wipe every extension's registrations, so it must not be
    // reachable through a scoped view.
    expect(PASSTHROUGH_METHODS).not.toContain('clear');
    expect(scoped.clear).toBeUndefined();
    expect(scoped.registerExtension).toBeUndefined();
  });
});

describe('bindPassthrough', () => {
  it('binds only the methods the target actually has', () => {
    const target = { a: () => 'a' };
    const bound = bindPassthrough(target, ['a', 'missing']);
    expect(bound.a()).toBe('a');
    expect(bound.missing).toBeUndefined();
  });

  it('keeps the target as the receiver', () => {
    const target = {
      value: 42,
      read() {
        return this.value;
      },
    };
    const { read } = bindPassthrough(target, ['read']);
    expect(read()).toBe(42);
  });
});
