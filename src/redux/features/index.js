/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redux Features - Public API
 *
 * Centralized export point for all Redux features.
 * Each feature exports actions, selectors, and its reducer.
 * Constants are kept internal to each feature.
 *
 * Features follow the Redux Ducks pattern:
 * - features/featureName/index.js - Public API (actions, selectors, reducer)
 * - features/featureName/actions.js - Action creators (private)
 * - features/featureName/constants.js - Action types (private, not exported)
 * - features/featureName/selector.js - Selectors (private)
 * - features/featureName/reducer.js - State reducer (private)
 */

// =============================================================================
// FEATURE: INTL (Internationalization)
// =============================================================================

export * from './intl';
export { default as intlReducer } from './intl';

// =============================================================================
// FEATURE: RUNTIME (Runtime Variables)
// =============================================================================

export * from './runtime';
export { default as runtimeReducer } from './runtime';

// =============================================================================
// FEATURE: USER (Authentication)
// =============================================================================

export * from './user';
export { default as userReducer } from './user';

// =============================================================================
// FEATURE: UI (UI State)
// =============================================================================

export * from './ui';
export { default as uiReducer } from './ui';

// =============================================================================
// FEATURE: ADMIN (Admin Features)
// =============================================================================
// Re-export all admin features (roles, groups, permissions, users, dashboard)
export * from './admin';
export { default as adminReducer } from './admin';
