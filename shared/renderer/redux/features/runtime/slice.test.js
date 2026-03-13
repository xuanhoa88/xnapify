/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import reducer, { setRuntimeVariable, resetRuntimeState } from './slice';
import { normalizeState } from './utils';

describe('[runtime] slice.js', () => {
  describe('normalizeState', () => {
    it('should handle null state', () => {
      const result = normalizeState(null);
      expect(result).toEqual({
        appName: null,
        appDescription: null,
        initialNow: null,
      });
    });

    it('should handle undefined state', () => {
      const result = normalizeState(undefined);
      expect(result).toEqual({
        appName: null,
        appDescription: null,
        initialNow: null,
      });
    });

    it('should clone and merge state', () => {
      const state = {
        appName: 'Test App',
        appDescription: 'Description',
        initialNow: 123456,
      };
      const result = normalizeState(state);
      expect(result).toEqual(state);
      expect(result).not.toBe(state); // Should be a clone
    });

    it('should merge with defaults for partial state', () => {
      const state = { appName: 'Test App' };
      const result = normalizeState(state);
      expect(result).toEqual({
        appName: 'Test App',
        appDescription: null,
        initialNow: null,
      });
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state).toEqual({
        appName: null,
        appDescription: null,
        initialNow: null,
      });
    });
  });

  describe('setRuntimeVariable', () => {
    it('should set single variable', () => {
      const state = reducer(
        undefined,
        setRuntimeVariable({ appName: 'My App' }),
      );
      expect(state.appName).toBe('My App');
      expect(state.appDescription).toBeNull();
    });

    it('should set multiple variables', () => {
      const state = reducer(
        undefined,
        setRuntimeVariable({
          appName: 'My App',
          appDescription: 'Description',
          initialNow: 123456,
        }),
      );
      expect(state).toEqual({
        appName: 'My App',
        appDescription: 'Description',
        initialNow: 123456,
      });
    });

    it('should update existing variables', () => {
      let state = reducer(
        undefined,
        setRuntimeVariable({ appName: 'Old Name' }),
      );
      state = reducer(state, setRuntimeVariable({ appName: 'New Name' }));
      expect(state.appName).toBe('New Name');
    });

    it('should preserve other variables when updating', () => {
      let state = reducer(
        undefined,
        setRuntimeVariable({
          appName: 'My App',
          appDescription: 'Description',
        }),
      );
      state = reducer(state, setRuntimeVariable({ initialNow: 123456 }));
      expect(state).toEqual({
        appName: 'My App',
        appDescription: 'Description',
        initialNow: 123456,
      });
    });
  });

  describe('resetRuntimeState', () => {
    it('should reset to initial state', () => {
      let state = reducer(
        undefined,
        setRuntimeVariable({
          appName: 'My App',
          appDescription: 'Description',
          initialNow: 123456,
        }),
      );
      state = reducer(state, resetRuntimeState());
      expect(state).toEqual({
        appName: null,
        appDescription: null,
        initialNow: null,
      });
    });
  });

  describe('State Immutability', () => {
    it('should not mutate original state', () => {
      const initialState = reducer(undefined, { type: '@@INIT' });
      const originalState = { ...initialState };
      reducer(initialState, setRuntimeVariable({ appName: 'Test' }));
      expect(initialState).toEqual(originalState);
    });
  });
});
