/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetch all settings grouped by namespace.
 */
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/settings');
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Save settings for a specific namespace.
 *
 * @param {{namespace: string, payload: Object}} args
 */
export const saveNamespaceSettings = createAsyncThunk(
  'settings/saveNamespaceSettings',
  async ({ namespace, payload }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/settings/${namespace}`, {
        method: 'PUT',
        body: payload,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
