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
 * Save (bulk update) settings.
 *
 * @param {Array<{namespace: string, key: string, value: string|null}>} updates
 */
export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (updates, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/settings', {
        method: 'PUT',
        body: { updates },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
