/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// =============================================================================
// STORE CONFIGURATION
// =============================================================================

export { default as configureStore } from './configureStore';

// =============================================================================
// FEATURES (Actions, Constants, Selectors, Reducers)
// =============================================================================

// Re-export all features from the centralized features index
export * from './features';

// =============================================================================
// ROOT REDUCER
// =============================================================================

// Root reducer (for advanced use cases)
export { default as rootReducer } from './rootReducer';
