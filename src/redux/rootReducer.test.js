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
});
