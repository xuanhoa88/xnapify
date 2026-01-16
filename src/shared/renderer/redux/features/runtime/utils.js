/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Create a fresh state object with default values.
 * This ensures we never return a reference to a frozen initialState.
 */
const createFreshState = () => ({
  appName: null,
  appDescription: null,
  initialNow: null,
});

// Initial state with fresh values
export const initialState = createFreshState();

/**
 * Normalize state to ensure it has the expected shape.
 * This handles migration from old state format or SSR hydration.
 * Always clones to ensure mutability (avoids SSR frozen state issues).
 * Exported for reuse in selectors.
 *
 * @param {Object|null|undefined} state - Runtime state to normalize
 * @returns {Object} Normalized state with expected shape
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return createFreshState();
  }

  // Clone and merge with defaults to ensure all properties exist
  return { ...createFreshState(), ...state };
};
