/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

describe('Container Engine', () => {
  let Container;
  let createFactory;

  beforeEach(() => {
    jest.resetModules();
    ({ Container, createFactory } = require('./index'));
  });

  // ===========================================================================
  // createFactory
  // ===========================================================================

  describe('createFactory()', () => {
    it('should return a new Container instance', () => {
      const container = createFactory();
      expect(container).toBeInstanceOf(Container);
    });

    it('should return independent instances', () => {
      const a = createFactory();
      const b = createFactory();
      expect(a).not.toBe(b);

      a.bind('x', () => 1);
      expect(a.has('x')).toBe(true);
      expect(b.has('x')).toBe(false);
    });
  });

  // ===========================================================================
  // Default export (singleton)
  // ===========================================================================

  describe('Default export', () => {
    it('should be a Container instance', () => {
      const container = require('./index').default;
      expect(container).toBeInstanceOf(Container);
    });
  });

  // ===========================================================================
  // bind() + resolve()
  // ===========================================================================

  describe('bind() / factory()', () => {
    it('should invoke the factory on every resolve()', () => {
      const container = createFactory();
      let count = 0;

      container.bind('counter', () => {
        count += 1;
        return count;
      });

      expect(container.resolve('counter')).toBe(1);
      expect(container.resolve('counter')).toBe(2);
      expect(container.resolve('counter')).toBe(3);
    });

    it('should pass the container to the factory', () => {
      const container = createFactory();

      container.bind('self', c => c);
      expect(container.resolve('self')).toBe(container);
    });

    it('factory() should behave identically to bind()', () => {
      const container = createFactory();
      let count = 0;

      container.factory('f', () => {
        count += 1;
        return count;
      });

      expect(container.resolve('f')).toBe(1);
      expect(container.resolve('f')).toBe(2);
    });

    it('should support chaining', () => {
      const container = createFactory();
      const result = container.bind('a', () => 1).bind('b', () => 2);
      expect(result).toBe(container);
    });
  });

  // ===========================================================================
  // singleton()
  // ===========================================================================

  describe('singleton()', () => {
    it('should invoke the factory only once', () => {
      const container = createFactory();
      const factory = jest.fn(() => ({ id: 42 }));

      container.singleton('svc', factory);

      const first = container.resolve('svc');
      const second = container.resolve('svc');

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(first).toEqual({ id: 42 });
    });

    it('should pass the container to the factory', () => {
      const container = createFactory();

      container.singleton('self', c => c);
      expect(container.resolve('self')).toBe(container);
    });

    it('should cache even if factory returns falsy value', () => {
      const container = createFactory();
      const factory = jest.fn(() => null);

      container.singleton('nullable', factory);

      expect(container.resolve('nullable')).toBeNull();
      expect(container.resolve('nullable')).toBeNull();
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // instance()
  // ===========================================================================

  describe('instance()', () => {
    it('should return the exact value without calling any factory', () => {
      const container = createFactory();
      const config = { debug: true };

      container.instance('config', config);
      expect(container.resolve('config')).toBe(config);
    });

    it('should work with primitive values', () => {
      const container = createFactory();

      container.instance('port', 3000);
      expect(container.resolve('port')).toBe(3000);

      container.instance('name', 'app');
      expect(container.resolve('name')).toBe('app');
    });

    it('should work with null and undefined', () => {
      const container = createFactory();

      container.instance('nil', null);
      expect(container.resolve('nil')).toBeNull();

      container.instance('undef', undefined);
      expect(container.resolve('undef')).toBeUndefined();
    });
  });

  // ===========================================================================
  // make() — alias for resolve()
  // ===========================================================================

  describe('make()', () => {
    it('should be an alias for resolve()', () => {
      const container = createFactory();
      container.instance('x', 42);
      expect(container.make('x')).toBe(42);
    });
  });

  // ===========================================================================
  // resolve() — error handling
  // ===========================================================================

  describe('resolve() errors', () => {
    it('should throw BindingNotFoundError for unregistered key', () => {
      const container = createFactory();

      expect(() => container.resolve('nope')).toThrow(/No binding registered/);

      try {
        container.resolve('nope');
      } catch (err) {
        expect(err.name).toBe('BindingNotFoundError');
        expect(err.code).toBe('E_BINDING_NOT_FOUND');
      }
    });
  });

  // ===========================================================================
  // has()
  // ===========================================================================

  describe('has()', () => {
    it('should return true for registered bindings', () => {
      const container = createFactory();
      container.bind('a', () => 1);
      container.singleton('b', () => 2);
      container.instance('c', 3);

      expect(container.has('a')).toBe(true);
      expect(container.has('b')).toBe(true);
      expect(container.has('c')).toBe(true);
    });

    it('should return false for unregistered bindings', () => {
      const container = createFactory();
      expect(container.has('nope')).toBe(false);
    });
  });

  // ===========================================================================
  // getBindingNames()
  // ===========================================================================

  describe('getBindingNames()', () => {
    it('should return all registered names', () => {
      const container = createFactory();
      container.bind('a', () => 1);
      container.singleton('b', () => 2);
      container.instance('c', 3);

      const names = container.getBindingNames();
      expect(names).toEqual(expect.arrayContaining(['a', 'b', 'c']));
      expect(names).toHaveLength(3);
    });

    it('should return empty array when no bindings exist', () => {
      const container = createFactory();
      expect(container.getBindingNames()).toEqual([]);
    });
  });

  // ===========================================================================
  // reset()
  // ===========================================================================

  describe('reset()', () => {
    it('should remove a single binding', () => {
      const container = createFactory();
      container.bind('a', () => 1);
      container.bind('b', () => 2);

      expect(container.reset('a')).toBe(true);
      expect(container.has('a')).toBe(false);
      expect(container.has('b')).toBe(true);
    });

    it('should return false when binding does not exist', () => {
      const container = createFactory();
      expect(container.reset('nope')).toBe(false);
    });
  });

  // ===========================================================================
  // cleanup()
  // ===========================================================================

  describe('cleanup()', () => {
    it('should remove all non-persistent bindings', () => {
      const container = createFactory();
      container.bind('a', () => 1);
      container.singleton('b', () => 2);
      container.instance('c', 3);

      container.cleanup();

      expect(container.has('a')).toBe(false);
      expect(container.has('b')).toBe(false);
      expect(container.has('c')).toBe(false);
      expect(container.getBindingNames()).toEqual([]);
    });

    it('should preserve persistent bindings by default', () => {
      const container = createFactory();
      container.bind('core', () => 'core-val', true);
      container.bind('temp', () => 'temp-val');

      container.cleanup();

      expect(container.has('core')).toBe(true);
      expect(container.resolve('core')).toBe('core-val');
      expect(container.has('temp')).toBe(false);
    });
  });

  // ===========================================================================
  // Overwriting bindings
  // ===========================================================================

  describe('Overwriting bindings', () => {
    it('should allow overwriting a binding with a new one', () => {
      const container = createFactory();

      container.bind('svc', () => 'v1');
      expect(container.resolve('svc')).toBe('v1');

      container.bind('svc', () => 'v2');
      expect(container.resolve('svc')).toBe('v2');
    });

    it('should allow changing binding type on overwrite', () => {
      const container = createFactory();

      container.bind('svc', () => 'factory');
      expect(container.resolve('svc')).toBe('factory');

      container.instance('svc', 'instance');
      expect(container.resolve('svc')).toBe('instance');
    });
  });

  // ===========================================================================
  // Persistent bindings
  // ===========================================================================

  describe('Persistent bindings (ownership key)', () => {
    const KEY_A = Symbol('module-a');
    const KEY_B = Symbol('module-b');

    // ── Overwrite protection ──────────────────────────────────────────────

    it('should prevent overwriting without a key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'auth', KEY_A);

      expect(() => container.bind('core:auth', () => 'evil')).toThrow(
        /persistent/i,
      );
      expect(container.resolve('core:auth')).toBe('auth');
    });

    it('should prevent overwriting with the wrong key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'auth', KEY_A);

      expect(() => container.bind('core:auth', () => 'evil', KEY_B)).toThrow(
        /persistent/i,
      );
    });

    it('should allow overwriting with the correct key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'v1', KEY_A);
      container.bind('core:auth', () => 'v2', KEY_A);

      expect(container.resolve('core:auth')).toBe('v2');
    });

    it('should prevent cross-type overwrite without key', () => {
      const container = createFactory();
      container.bind('core:svc', () => 'svc', KEY_A);

      expect(() => container.instance('core:svc', 'val')).toThrow(
        /persistent/i,
      );
      expect(() => container.singleton('core:svc', () => 'val')).toThrow(
        /persistent/i,
      );
    });

    // ── Works for all registration types ──────────────────────────────────

    it('should protect persistent singleton()', () => {
      const container = createFactory();
      container.singleton('core:db', () => 'db', KEY_A);

      expect(() => container.singleton('core:db', () => 'evil')).toThrow(
        /persistent/i,
      );
    });

    it('should protect persistent instance()', () => {
      const container = createFactory();
      container.instance('core:config', { a: 1 }, KEY_A);

      expect(() => container.instance('core:config', { a: 2 })).toThrow(
        /persistent/i,
      );
      expect(container.resolve('core:config')).toEqual({ a: 1 });
    });

    it('should support persistent with factory() alias', () => {
      const container = createFactory();
      container.factory('core:svc', () => 'svc', KEY_A);

      expect(() => container.factory('core:svc', () => 'evil')).toThrow(
        /persistent/i,
      );
    });

    // ── reset() ────────────────────────────────────────────────────────────

    it('should prevent reset() without key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'auth', KEY_A);

      expect(() => container.reset('core:auth')).toThrow(/persistent/i);
      expect(container.has('core:auth')).toBe(true);
    });

    it('should prevent reset() with wrong key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'auth', KEY_A);

      expect(() => container.reset('core:auth', KEY_B)).toThrow(/persistent/i);
    });

    it('should allow reset() with correct key', () => {
      const container = createFactory();
      container.bind('core:auth', () => 'auth', KEY_A);

      expect(container.reset('core:auth', KEY_A)).toBe(true);
      expect(container.has('core:auth')).toBe(false);
    });

    // ── cleanup() ──────────────────────────────────────────────────────────

    it('cleanup() without args should preserve all persistent bindings', () => {
      const container = createFactory();
      container.bind('core', () => 'core-val', KEY_A);
      container.bind('temp', () => 'temp-val');

      container.cleanup();

      expect(container.has('core')).toBe(true);
      expect(container.has('temp')).toBe(false);
    });

    it('cleanup(key) should remove matching persistent + non-persistent', () => {
      const container = createFactory();
      container.bind('a', () => 'a-val', KEY_A);
      container.bind('b', () => 'b-val', KEY_B);
      container.bind('c', () => 'c-val');

      container.cleanup(KEY_A);

      expect(container.has('a')).toBe(false); // removed: matches KEY_A
      expect(container.has('b')).toBe(true); // preserved: different key
      expect(container.has('c')).toBe(false); // removed: non-persistent
    });

    it('cleanup(k1, k2) should remove multiple owners at once', () => {
      const container = createFactory();
      const KEY_C = Symbol('module-c');
      container.bind('a', () => 1, KEY_A);
      container.bind('b', () => 2, KEY_B);
      container.bind('c', () => 3, KEY_C);
      container.bind('d', () => 4);

      container.cleanup(KEY_A, KEY_B);

      expect(container.has('a')).toBe(false);
      expect(container.has('b')).toBe(false);
      expect(container.has('c')).toBe(true); // different key, preserved
      expect(container.has('d')).toBe(false); // non-persistent, removed
    });

    // ── Error shape ────────────────────────────────────────────────────────

    it('should throw PersistentBindingError with correct name and code', () => {
      const container = createFactory();
      container.instance('locked', 42, KEY_A);

      try {
        container.instance('locked', 99);
      } catch (err) {
        expect(err.name).toBe('PersistentBindingError');
        expect(err.code).toBe('E_PERSISTENT_BINDING');
      }
    });

    // ── Backward compat: `true` as owner key ──────────────────────────────

    it('should work with boolean true as owner key (backward compat)', () => {
      const container = createFactory();
      container.bind('legacy', () => 'val', true);

      // Cannot overwrite without key
      expect(() => container.bind('legacy', () => 'evil')).toThrow(
        /persistent/i,
      );

      // Can overwrite with same key (true)
      container.bind('legacy', () => 'v2', true);
      expect(container.resolve('legacy')).toBe('v2');

      // cleanup() without args preserves it
      container.cleanup();
      expect(container.has('legacy')).toBe(true);

      // cleanup(true) removes it
      container.cleanup(true);
      expect(container.has('legacy')).toBe(false);
    });

    it('should allow non-persistent bindings to be overwritten normally', () => {
      const container = createFactory();
      container.bind('temp', () => 'v1');
      container.bind('temp', () => 'v2');
      expect(container.resolve('temp')).toBe('v2');
    });
  });

  // ===========================================================================
  // Validation
  // ===========================================================================

  describe('Validation', () => {
    it('should throw TypeError for invalid binding name', () => {
      const container = createFactory();

      expect(() => container.bind('', () => 1)).toThrow(TypeError);
      expect(() => container.bind(123, () => 1)).toThrow(TypeError);
      expect(() => container.bind(null, () => 1)).toThrow(TypeError);
    });

    it('should throw TypeError for non-function factory in bind()', () => {
      const container = createFactory();

      expect(() => container.bind('x', 'not a function')).toThrow(TypeError);
      expect(() => container.bind('x', 42)).toThrow(TypeError);
      expect(() => container.bind('x', null)).toThrow(TypeError);
    });

    it('should throw TypeError for non-function factory in singleton()', () => {
      const container = createFactory();

      expect(() => container.singleton('x', 'not a function')).toThrow(
        TypeError,
      );
    });

    it('should not throw for instance() with any value type', () => {
      const container = createFactory();

      expect(() => container.instance('a', null)).not.toThrow();
      expect(() => container.instance('b', undefined)).not.toThrow();
      expect(() => container.instance('c', 0)).not.toThrow();
      expect(() => container.instance('d', '')).not.toThrow();
      expect(() => container.instance('e', false)).not.toThrow();
    });
  });

  // ===========================================================================
  // Real-world scenario: users:services pattern
  // ===========================================================================

  describe('Real-world: users:services pattern', () => {
    it('should work with the existing bindServices pattern', () => {
      const container = createFactory();

      container.bind('users:services', () => ({
        controllers: {
          login: () => 'login',
          logout: () => 'logout',
        },
        utils: {
          generateToken: () => 'token',
        },
      }));

      const services = container.resolve('users:services');
      expect(services.controllers.login()).toBe('login');
      expect(services.utils.generateToken()).toBe('token');

      // Each resolve returns a new object (factory binding)
      const services2 = container.resolve('users:services');
      expect(services2).not.toBe(services);
      expect(services2.controllers.login()).toBe('login');
    });
  });
});
