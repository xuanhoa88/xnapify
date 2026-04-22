/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import configureStore from './configureStore';

describe('[redux] configureStore.js', () => {
  describe('Basic Store Creation', () => {
    it('should create a store with default configuration', () => {
      const store = configureStore();
      expect(store).toBeDefined();
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');
    });

    it('should initialize with root reducers', () => {
      const store = configureStore();
      const state = store.getState();

      // Verify root reducers are present
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('runtime');
      expect(state).toHaveProperty('intl');
      expect(state).toHaveProperty('ui');
    });

    it('should accept initial state', () => {
      const initialState = {
        runtime: {
          appName: 'Test App',
          appDescription: 'Test Description',
          initialNow: 123456,
        },
      };
      const store = configureStore(initialState);
      const state = store.getState();
      expect(state.runtime.appName).toBe('Test App');
    });

    it('should configure thunk with helpers', () => {
      const helpers = {
        fetch: jest.fn(),
        history: {},
        i18n: {},
      };
      const store = configureStore({}, helpers);

      // Store should be created successfully with helpers
      expect(store).toBeDefined();
    });
  });

  describe('Dynamic Reducer Injection', () => {
    it('should expose injectReducer method', () => {
      const store = configureStore();
      expect(typeof store.injectReducer).toBe('function');
    });

    it('should inject new reducer', () => {
      const store = configureStore();
      const testReducer = (state = { value: 'test' }) => state;

      store.injectReducer('testModule', testReducer);

      const state = store.getState();
      expect(state.testModule).toEqual({ value: 'test' });
    });

    it('should not re-inject existing reducer without force option', () => {
      const store = configureStore();
      const reducer1 = (state = { value: 'first' }) => state;
      const reducer2 = (state = { value: 'second' }) => state;

      store.injectReducer('testModule', reducer1);
      store.injectReducer('testModule', reducer2);

      const state = store.getState();
      expect(state.testModule).toEqual({ value: 'first' });
    });

    it('should throw error for invalid reducer key', () => {
      const store = configureStore();
      const testReducer = (state = {}) => state;

      expect(() => {
        store.injectReducer('', testReducer);
      }).toThrow('[Redux] injectReducer: key must be a non-empty string');

      expect(() => {
        store.injectReducer(null, testReducer);
      }).toThrow('[Redux] injectReducer: key must be a non-empty string');
    });

    it('should throw error for invalid reducer function', () => {
      const store = configureStore();

      expect(() => {
        store.injectReducer('testModule', 'not a function');
      }).toThrow('[Redux] injectReducer: reducer must be a function');

      expect(() => {
        store.injectReducer('testModule', null);
      }).toThrow('[Redux] injectReducer: reducer must be a function');
    });

    it('should update state after injecting reducer', () => {
      const store = configureStore();
      const testReducer = (state = { count: 0 }, action) => {
        if (action.type === 'INCREMENT') {
          return { count: state.count + 1 };
        }
        return state;
      };

      store.injectReducer('counter', testReducer);
      store.dispatch({ type: 'INCREMENT' });

      const state = store.getState();
      expect(state.counter.count).toBe(1);
    });
  });

  describe('Identity Reducer Handling', () => {
    it('should create identity reducers for SSR state', () => {
      const initialState = {
        user: { data: null, operations: {} },
        dynamicModule: { someData: 'test' },
      };

      const store = configureStore(initialState);
      const state = store.getState();

      // Dynamic module should preserve its state
      expect(state.dynamicModule).toEqual({ someData: 'test' });
    });

    it('should replace identity reducer when real reducer is injected', () => {
      const initialState = {
        dynamicModule: { loading: false, data: 'ssr-data' },
      };

      const store = configureStore(initialState);

      // SSR state should be preserved initially
      let state = store.getState();
      expect(state.dynamicModule).toEqual({ loading: false, data: 'ssr-data' });

      // Inject real reducer
      const realReducer = (state = { data: null }, action) => {
        if (action.type === 'SET_DATA') {
          return { data: action.payload };
        }
        return state;
      };

      store.injectReducer('dynamicModule', realReducer);

      // Dispatch action
      store.dispatch({ type: 'SET_DATA', payload: 'new-data' });

      state = store.getState();
      expect(state.dynamicModule.data).toBe('new-data');
    });

    it('should detect identity reducers', () => {
      const initialState = {
        dynamicModule: { data: 'test' },
      };

      const store = configureStore(initialState);

      expect(store.isIdentityReducer('dynamicModule')).toBe(true);
      // Root reducers are not in injectedReducers, so they return false/undefined
      expect(store.isIdentityReducer('user')).toBeFalsy();
    });

    it('should clear identity reducer flag after replacement', () => {
      const initialState = {
        dynamicModule: { data: 'test' },
      };

      const store = configureStore(initialState);
      const realReducer = (state = {}) => state;

      expect(store.isIdentityReducer('dynamicModule')).toBe(true);

      store.injectReducer('dynamicModule', realReducer);

      expect(store.isIdentityReducer('dynamicModule')).toBe(false);
    });
  });

  describe('SSR State Handling', () => {
    it('should separate root and dynamic state', () => {
      const initialState = {
        user: { data: { id: 1, email: 'test@example.com' }, operations: {} },
        runtime: { appName: 'SSR App', appDescription: null, initialNow: null },
        dynamicModule1: { data: 'module1' },
        dynamicModule2: { data: 'module2' },
      };

      const store = configureStore(initialState);
      const state = store.getState();

      // Root state should be initialized
      expect(state.user.data).toEqual({ id: 1, email: 'test@example.com' });
      expect(state.runtime.appName).toBe('SSR App');

      // Dynamic state should be preserved
      expect(state.dynamicModule1).toEqual({ data: 'module1' });
      expect(state.dynamicModule2).toEqual({ data: 'module2' });
    });

    it('should not warn about unexpected keys for dynamic state', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const initialState = {
        user: { data: null, operations: {} },
        dynamicModule: { data: 'test' },
      };

      configureStore(initialState);

      // Should not have warnings about unexpected keys
      expect(consoleWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('Unexpected key'),
      );

      consoleWarn.mockRestore();
    });
  });

  describe('Store Utility Methods', () => {
    it('should provide getInjectedReducers method', () => {
      const store = configureStore();
      expect(typeof store.getInjectedReducers).toBe('function');
    });

    it('should return injected reducer keys', () => {
      const initialState = {
        dynamicModule1: { data: 'test1' },
        dynamicModule2: { data: 'test2' },
      };

      const store = configureStore(initialState);

      const injected = store.getInjectedReducers();
      expect(injected).toContain('dynamicModule1');
      expect(injected).toContain('dynamicModule2');
    });

    it('should update injected reducers list when adding new reducers', () => {
      const store = configureStore();
      const testReducer = (state = {}) => state;

      store.injectReducer('module1', testReducer);
      let injected = store.getInjectedReducers();
      expect(injected).toContain('module1');

      store.injectReducer('module2', testReducer);
      injected = store.getInjectedReducers();
      expect(injected).toContain('module1');
      expect(injected).toContain('module2');
    });

    it('should provide hasReducer method', () => {
      const store = configureStore();
      expect(typeof store.hasReducer).toBe('function');
    });

    it('should correctly check if reducer exists', () => {
      const store = configureStore();
      const testReducer = (state = {}) => state;

      expect(store.hasReducer('testModule')).toBe(false);

      store.injectReducer('testModule', testReducer);

      expect(store.hasReducer('testModule')).toBe(true);
    });

    it('should provide isIdentityReducer method', () => {
      const store = configureStore();
      expect(typeof store.isIdentityReducer).toBe('function');
    });
  });

  describe('Middleware Configuration', () => {
    it('should configure thunk middleware with extraArgument', () => {
      const mockFetch = jest.fn();
      const helpers = {
        fetch: mockFetch,
        history: { push: jest.fn() },
        i18n: { changeLanguage: jest.fn() },
      };

      const store = configureStore({}, helpers);

      // Create a thunk that uses the helpers
      const testThunk = () => (dispatch, getState, extra) => {
        expect(extra.fetch).toBe(mockFetch);
        expect(extra.history).toBeDefined();
        expect(extra.i18n).toBeDefined();
      };

      store.dispatch(testThunk());
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete Redux flow', () => {
      const store = configureStore();

      // Inject admin module reducer
      const adminReducer = (state = { users: [] }, action) => {
        switch (action.type) {
          case 'ADD_USER':
            return { users: [...state.users, action.payload] };
          default:
            return state;
        }
      };

      store.injectReducer('admin', adminReducer);

      // Dispatch action
      store.dispatch({ type: 'ADD_USER', payload: { id: 1, name: 'John' } });

      const state = store.getState();
      expect(state.admin.users).toHaveLength(1);
      expect(state.admin.users[0].name).toBe('John');
    });

    it('should handle multiple dynamic modules', () => {
      const store = configureStore();

      const reducer1 = (state = { value: 1 }) => state;
      const reducer2 = (state = { value: 2 }) => state;
      const reducer3 = (state = { value: 3 }) => state;

      store.injectReducer('module1', reducer1);
      store.injectReducer('module2', reducer2);
      store.injectReducer('module3', reducer3);

      const state = store.getState();
      expect(state.module1.value).toBe(1);
      expect(state.module2.value).toBe(2);
      expect(state.module3.value).toBe(3);
    });

    it('should maintain state after multiple injections', () => {
      const store = configureStore();

      const counterReducer = (state = { count: 0 }, action) => {
        if (action.type === 'INCREMENT') {
          return { count: state.count + 1 };
        }
        return state;
      };

      store.injectReducer('counter', counterReducer);
      store.dispatch({ type: 'INCREMENT' });

      let state = store.getState();
      expect(state.counter.count).toBe(1);

      // Inject another module
      const otherReducer = (state = { value: 'other' }) => state;
      store.injectReducer('other', otherReducer);

      // Original state should be preserved
      state = store.getState();
      expect(state.counter.count).toBe(1);
      expect(state.other.value).toBe('other');
    });
  });

  describe('Reducer Removal', () => {
    it('should remove an injected reducer', () => {
      const store = configureStore();
      const testReducer = (state = { value: 'test' }) => state;

      store.injectReducer('removable', testReducer);
      expect(store.getState().removable).toEqual({ value: 'test' });

      const result = store.removeReducer('removable');
      expect(result).toBe(true);
      expect(store.hasReducer('removable')).toBe(false);
      expect(store.getState().removable).toBeUndefined();
    });

    it('should return false when removing non-existent reducer', () => {
      const store = configureStore();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const result = store.removeReducer('nonExistent');
      expect(result).toBe(false);

      consoleWarn.mockRestore();
    });

    it('should preserve other reducers after removal', () => {
      const store = configureStore();
      const reducer1 = (state = { v: 1 }) => state;
      const reducer2 = (state = { v: 2 }) => state;

      store.injectReducer('mod1', reducer1);
      store.injectReducer('mod2', reducer2);

      store.removeReducer('mod1');

      expect(store.hasReducer('mod1')).toBe(false);
      expect(store.getState().mod2).toEqual({ v: 2 });
    });
  });

  describe('Batch Inject Reducers', () => {
    it('should inject multiple reducers with single rebuild', () => {
      const store = configureStore();
      const replaceReducerSpy = jest.spyOn(store, 'replaceReducer');

      const result = store.batchInjectReducers({
        batchA: (state = { a: 1 }) => state,
        batchB: (state = { b: 2 }) => state,
        batchC: (state = { c: 3 }) => state,
      });

      expect(result.injected).toEqual(['batchA', 'batchB', 'batchC']);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual({});

      // Should only call replaceReducer once for all three
      expect(replaceReducerSpy).toHaveBeenCalledTimes(1);

      const state = store.getState();
      expect(state.batchA).toEqual({ a: 1 });
      expect(state.batchB).toEqual({ b: 2 });
      expect(state.batchC).toEqual({ c: 3 });

      replaceReducerSpy.mockRestore();
    });

    it('should separate skipped from failed reducers', () => {
      const store = configureStore();
      const existingReducer = (state = { existing: true }) => state;
      store.injectReducer('existing', existingReducer);

      const result = store.batchInjectReducers({
        existing: (state = { new: true }) => state, // should be skipped
        '@@reserved': (state = {}) => state, // should fail (reserved key)
        newModule: (state = { val: 1 }) => state, // should succeed
      });

      expect(result.injected).toEqual(['newModule']);
      expect(result.skipped).toEqual(['existing']);
      expect(result.failed).toHaveProperty('@@reserved');
      expect(result.failed['@@reserved']).toContain('reserved');
    });

    it('should throw for non-object input', () => {
      const store = configureStore();

      expect(() => store.batchInjectReducers(null)).toThrow(
        'reducers must be a plain object',
      );
      expect(() => store.batchInjectReducers([1, 2])).toThrow(
        'reducers must be a plain object',
      );
      expect(() => store.batchInjectReducers('string')).toThrow(
        'reducers must be a plain object',
      );
    });

    it('should not call replaceReducer when all reducers are skipped', () => {
      const store = configureStore();
      const reducer = (state = {}) => state;
      store.injectReducer('mod1', reducer);

      const replaceReducerSpy = jest.spyOn(store, 'replaceReducer');

      store.batchInjectReducers({ mod1: reducer });

      expect(replaceReducerSpy).not.toHaveBeenCalled();
      replaceReducerSpy.mockRestore();
    });
  });

  describe('Batch Remove Reducers', () => {
    it('should remove multiple reducers with single rebuild', () => {
      const store = configureStore();
      const reducer = (state = {}) => state;

      store.injectReducer('rem1', reducer);
      store.injectReducer('rem2', reducer);
      store.injectReducer('rem3', reducer);

      const replaceReducerSpy = jest.spyOn(store, 'replaceReducer');

      const result = store.batchRemoveReducers(['rem1', 'rem2']);

      expect(result.removed).toEqual(['rem1', 'rem2']);
      expect(result.notFound).toEqual([]);
      expect(replaceReducerSpy).toHaveBeenCalledTimes(1);

      expect(store.hasReducer('rem1')).toBe(false);
      expect(store.hasReducer('rem2')).toBe(false);
      expect(store.hasReducer('rem3')).toBe(true);

      replaceReducerSpy.mockRestore();
    });

    it('should report not-found keys', () => {
      const store = configureStore();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const result = store.batchRemoveReducers([
        'nonExistent1',
        'nonExistent2',
      ]);

      expect(result.removed).toEqual([]);
      expect(result.notFound).toEqual(['nonExistent1', 'nonExistent2']);

      consoleWarn.mockRestore();
    });

    it('should throw for non-array input', () => {
      const store = configureStore();

      expect(() => store.batchRemoveReducers('key')).toThrow(
        'keys must be an array',
      );
      expect(() => store.batchRemoveReducers({})).toThrow(
        'keys must be an array',
      );
    });
  });

  describe('Reducer Change Listeners', () => {
    it('should notify listeners on inject', () => {
      const store = configureStore();
      const listener = jest.fn();

      store.onReducerChange(listener);
      store.injectReducer('listened', (state = {}) => state);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'listened',
          action: 'injected',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should notify listeners on remove', () => {
      const store = configureStore();
      const listener = jest.fn();
      store.injectReducer('toRemove', (state = {}) => state);

      store.onReducerChange(listener);
      store.removeReducer('toRemove');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'toRemove',
          action: 'removed',
        }),
      );
    });

    it('should return unsubscribe function', () => {
      const store = configureStore();
      const listener = jest.fn();

      const unsubscribe = store.onReducerChange(listener);
      unsubscribe();

      store.injectReducer('afterUnsub', (state = {}) => state);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should throw for non-function listener', () => {
      const store = configureStore();

      expect(() => store.onReducerChange('not a function')).toThrow(
        'listener must be a function',
      );
      expect(() => store.onReducerChange(null)).toThrow(
        'listener must be a function',
      );
    });

    it('should handle listener errors without breaking others', () => {
      const store = configureStore();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const badListener = () => {
        throw new Error('listener crash');
      };
      const goodListener = jest.fn();

      store.onReducerChange(badListener);
      store.onReducerChange(goodListener);

      store.injectReducer('robust', (state = {}) => state);

      expect(goodListener).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Store Statistics', () => {
    it('should return correct stats shape', () => {
      const store = configureStore();
      const stats = store.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          rootReducers: expect.any(Number),
          injectedReducers: expect.any(Number),
          identityReducers: expect.any(Number),
          listeners: expect.any(Number),
        }),
      );
    });

    it('should reflect injected and identity reducer counts', () => {
      const initialState = {
        ssrModule: { data: 'ssr' },
      };
      const store = configureStore(initialState);

      let stats = store.getStats();
      expect(stats.injectedReducers).toBe(1);
      expect(stats.identityReducers).toBe(1);

      store.injectReducer('ssrModule', (state = {}) => state);
      store.injectReducer('newModule', (state = {}) => state);

      stats = store.getStats();
      expect(stats.injectedReducers).toBe(2);
      expect(stats.identityReducers).toBe(0);
    });

    it('should reflect listener count', () => {
      const store = configureStore();
      expect(store.getStats().listeners).toBe(0);

      const unsub = store.onReducerChange(() => {});
      expect(store.getStats().listeners).toBe(1);

      unsub();
      expect(store.getStats().listeners).toBe(0);
    });
  });

  describe('Reserved and Conflicting Keys', () => {
    it('should reject keys starting with @@', () => {
      const store = configureStore();
      expect(() =>
        store.injectReducer('@@internal', (state = {}) => state),
      ).toThrow('reserved and cannot be used');
    });

    it('should reject keys starting with __', () => {
      const store = configureStore();
      expect(() =>
        store.injectReducer('__private', (state = {}) => state),
      ).toThrow('reserved and cannot be used');
    });

    it('should reject keys that conflict with Object.prototype', () => {
      const store = configureStore();
      expect(() =>
        store.injectReducer('constructor', (state = {}) => state),
      ).toThrow('conflicts with Object.prototype');

      expect(() =>
        store.injectReducer('toString', (state = {}) => state),
      ).toThrow('conflicts with Object.prototype');

      expect(() =>
        store.injectReducer('hasOwnProperty', (state = {}) => state),
      ).toThrow('conflicts with Object.prototype');
    });

    it('should reject keys that conflict with root reducers', () => {
      const store = configureStore();
      expect(() => store.injectReducer('user', (state = {}) => state)).toThrow(
        'conflicts with root reducer',
      );
    });
  });

  describe('Force Re-injection', () => {
    it('should replace existing reducer with force option', () => {
      const store = configureStore();
      const original = (state = { version: 1 }, action) => {
        if (action.type === 'V1_ACTION') return { ...state, v1: true };
        return state;
      };
      const replacement = (state = { version: 2 }, action) => {
        if (action.type === 'V2_ACTION') return { ...state, v2: true };
        return state;
      };

      store.injectReducer('forceTest', original);
      expect(store.getState().forceTest).toEqual({ version: 1 });

      const result = store.injectReducer('forceTest', replacement, {
        force: true,
      });
      expect(result).toBe(true);

      // Existing state is preserved by replaceReducer, but the new reducer handles actions
      store.dispatch({ type: 'V2_ACTION' });
      expect(store.getState().forceTest.v2).toBe(true);
    });
  });

  describe('hasReducer Prototype Safety', () => {
    it('should return false for Object.prototype properties', () => {
      const store = configureStore();
      // These would return true with the `in` operator
      expect(store.hasReducer('constructor')).toBe(false);
      expect(store.hasReducer('toString')).toBe(false);
      expect(store.hasReducer('valueOf')).toBe(false);
    });
  });
});
