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
 */
const runtimeSlice = createSlice({
  name: 'runtime',
  initialState: {},
  reducers: {
    /**
     * Set runtime variable(s)
     *
     * Sets one or more runtime variables by merging the payload into the runtime state.
     *
     * @example
     * // Single variable
     * dispatch(setRuntimeVariable({ appName: 'My App' }));
     *
     * @example
     * // Multiple variables
     * dispatch(setRuntimeVariable({
     *   initialNow: Date.now(),
     *   appName: 'React Starter Kit',
     *   appDescription: 'Boilerplate...'
     * }));
     */
    setRuntimeVariable: (state, action) => {
      Object.assign(state, action.payload);
    },
  },
});

export const { setRuntimeVariable } = runtimeSlice.actions;
export default runtimeSlice.reducer;
