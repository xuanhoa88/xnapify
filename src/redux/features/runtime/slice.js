/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Runtime Slice
 *
 * Manages runtime variables that are set during app initialization.
 * These are typically set during SSR and hydrated on the client.
 *
 * State shape:
 * {
 *   appName: string | null,
 *   appDescription: string | null,
 *   initialNow: number | null,
 *   // ... other runtime variables
 * }
 *
 * @example
 * // Set runtime variables during SSR
 * dispatch(setRuntimeVariable({
 *   initialNow: Date.now(),
 *   appName: 'React Starter Kit',
 *   appDescription: 'Boilerplate...'
 * }));
 *
 * @example
 * // Set a single variable
 * dispatch(setRuntimeVariable({ appName: 'My App' }));
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
const initialState = createFreshState();

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

const runtimeSlice = createSlice({
  name: 'runtime',
  initialState,
  reducers: {
    /**
     * Set runtime variable(s)
     *
     * Sets one or more runtime variables by merging the payload into the runtime state.
     *
     * @param {Object} state - Current state
     * @param {Object} action - Action with payload containing variables to set
     */
    setRuntimeVariable: (state, action) => {
      Object.assign(state, action.payload);
    },

    /**
     * Reset to initial state (used for SSR hydration edge cases)
     */
    resetRuntimeState: () => initialState,
  },
});

export const { setRuntimeVariable, resetRuntimeState } = runtimeSlice.actions;
export default runtimeSlice.reducer;
