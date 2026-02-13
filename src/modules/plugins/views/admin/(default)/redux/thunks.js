/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Plugins Thunks
 *
 * Async thunk actions for admin plugins CRUD operations.
 */

/**
 * Fetch all plugins
 */
export const fetchPlugins = createAsyncThunk(
  'admin/plugins/fetchPlugins',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/plugins/admin');
      return data.plugins || [];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Upload a plugin
 */
export const uploadPlugin = createAsyncThunk(
  'admin/plugins/uploadPlugin',
  async (file, { extra: { fetch }, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await fetch('/api/plugins/admin/upload', {
        method: 'POST',
        body: formData,
      });
      return data.plugin;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Upgrade a plugin
 */
export const upgradePlugin = createAsyncThunk(
  'admin/plugins/upgradePlugin',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/plugins/admin/${id}/upgrade`, {
        method: 'POST',
      });
      return data.plugin;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Toggle plugin status
 */
export const togglePluginStatus = createAsyncThunk(
  'admin/plugins/toggleStatus',
  async ({ id, isActive }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/plugins/admin/${id}/status`, {
        method: 'PATCH',
        body: { is_active: isActive },
      });
      return data.plugin;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

/**
 * Uninstall plugin
 */
export const uninstallPlugin = createAsyncThunk(
  'admin/plugins/uninstall',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/plugins/admin/${id}`, {
        method: 'DELETE',
      });
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
