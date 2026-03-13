/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { combineReducers } from '@reduxjs/toolkit';

import rootReducer from './rootReducer';

describe('[rootReducer] rootReducer.js', () => {
  it('should export an object of reducers for dynamic injection', () => {
    // rootReducer now exports an object of slice reducers
    // that gets combined in configureStore.js
    expect(typeof rootReducer).toBe('object');
    expect(rootReducer).not.toBeNull();
  });

  it('should produce a valid reducer when combined', () => {
    const combinedReducer = combineReducers(rootReducer);
    expect(typeof combinedReducer).toBe('function');
    expect(typeof combinedReducer(undefined, { type: '@@INIT' })).toBe(
      'object',
    );
  });

  it('should include core slice reducers', () => {
    // Verify expected core reducers are present
    expect(rootReducer).toHaveProperty('user');
    expect(rootReducer).toHaveProperty('runtime');
    expect(rootReducer).toHaveProperty('intl');
    expect(rootReducer).toHaveProperty('ui');
  });

  it('should have function as each reducer value', () => {
    Object.entries(rootReducer).forEach(([_, reducer]) => {
      expect(typeof reducer).toBe('function');
    });
  });

  it('should initialize each reducer with correct state', () => {
    const combinedReducer = combineReducers(rootReducer);
    const state = combinedReducer(undefined, { type: '@@INIT' });

    // User reducer should have proper structure
    expect(state.user).toBeDefined();
    expect(state.user).toHaveProperty('data');
    expect(state.user).toHaveProperty('operations');

    // Runtime reducer should have proper structure
    expect(state.runtime).toBeDefined();
    expect(state.runtime).toHaveProperty('appName');
    expect(state.runtime).toHaveProperty('appDescription');
    expect(state.runtime).toHaveProperty('initialNow');

    // Intl reducer should have proper structure
    expect(state.intl).toBeDefined();
    expect(state.intl).toHaveProperty('locale');
    expect(state.intl).toHaveProperty('availableLocales');

    // UI reducer should have proper structure
    expect(state.ui).toBeDefined();
    expect(state.ui).toHaveProperty('drawers');
    expect(state.ui).toHaveProperty('breadcrumbs');
    expect(state.ui).toHaveProperty('flashMessage');
  });

  it('should not export admin reducers directly', () => {
    // Admin reducers should be dynamically injected
    expect(rootReducer).not.toHaveProperty('admin');
  });

  it('should have exactly 4 core reducers', () => {
    const keys = Object.keys(rootReducer);
    expect(keys).toHaveLength(4);
    expect(keys).toEqual(['user', 'runtime', 'intl', 'ui']);
  });
});
