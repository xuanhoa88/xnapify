/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// =============================================================================
// STORE CONFIGURATION
// =============================================================================

export { default as configureStore } from './configureStore.js';

// =============================================================================
// FEATURES (Actions, Constants, Selectors, Reducers)
// =============================================================================

// Export the single features object (dynamic imports)
export { default as features } from './features/index.js';

// =============================================================================
// ROOT REDUCER
// =============================================================================

// Root reducer (for advanced use cases)
export { default as rootReducer } from './rootReducer.js';
