/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState } from './utils';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const selectRuntimeRaw = state => state && state.runtime;

/**
 * Safely get runtime state with normalization
 *
 * @param {Object} state - Redux state
 * @returns {Object} Normalized runtime state
 */
const getRuntimeState = createSelector([selectRuntimeRaw], runtime =>
  normalizeState(runtime),
);

// =============================================================================
// TYPED SELECTORS (for known runtime variables)
// =============================================================================

/**
 * Get application name
 *
 * @param {Object} state - Redux state
 * @param {string} [defaultValue='xnapify'] - Default value if not set
 * @returns {string} Application name
 */
export const getAppName = (state, defaultValue = 'xnapify') => {
  const runtime = getRuntimeState(state);
  return runtime.appName != null ? runtime.appName : defaultValue;
};

/**
 * Get application description
 *
 * @param {Object} state - Redux state
 * @param {string} [defaultValue='Snap your API, Stream your React'] - Default value if not set
 * @returns {string} Application description
 */
export const getAppDescription = (
  state,
  defaultValue = 'Snap your API, Stream your React',
) => {
  const runtime = getRuntimeState(state);
  return runtime.appDescription != null ? runtime.appDescription : defaultValue;
};

/**
 * Get initial timestamp (set during SSR)
 *
 * @param {Object} state - Redux state
 * @returns {number|null} Initial timestamp in milliseconds, or null if not set
 */
export const getInitialNow = state => {
  const runtime = getRuntimeState(state);
  return runtime.initialNow != null ? runtime.initialNow : null;
};

// =============================================================================
// GENERIC SELECTOR (for dynamic/custom runtime variables)
// =============================================================================

/**
 * Get a runtime variable by name
 *
 * Use this for custom runtime variables not covered by typed selectors.
 * For known variables, prefer the typed selectors (getAppName, etc.).
 *
 * @param {Object} state - Redux state
 * @param {string} name - Variable name
 * @param {*} [defaultValue] - Default value if variable doesn't exist
 * @returns {*} Variable value or defaultValue
 *
 * @example
 * // Get custom runtime variable
 * const value = getRuntimeVariable(state, 'customVar', 'default');
 */
export const getRuntimeVariable = (state, name, defaultValue) => {
  const runtime = getRuntimeState(state);
  const value = runtime[name];
  return value != null ? value : defaultValue;
};
