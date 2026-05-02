/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetch public settings from the API.
 * Only returns settings flagged as public (no auth required).
 */
export const fetchPublicSettings = createAsyncThunk(
  'settings/fetchPublic',
  async (_, { extra: { fetch } }) => {
    const { data } = await fetch('/api/settings/public');
    return data;
  },
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {},
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchPublicSettings.fulfilled, (state, action) => {
      return action.payload;
    });
  },
});

/**
 * Select a single setting value by key.
 * @param {Object} state - Redux root state
 * @param {string} key - Setting key (e.g. 'auth.ALLOW_REGISTRATION')
 * @returns {*} Setting value or undefined
 */
export const selectSetting = (state, key) =>
  state.settings != null ? state.settings[key] : undefined;

export default settingsSlice.reducer;
