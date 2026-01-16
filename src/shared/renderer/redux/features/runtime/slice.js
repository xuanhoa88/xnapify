/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import { initialState } from './utils';

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
