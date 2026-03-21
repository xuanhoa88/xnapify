/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Extensions Thunks
 *
 * Async thunk actions for admin extensions CRUD operations.
 */

/**
 * Fetch all extensions
 */
export const fetchExtensions = createAsyncThunk(
  'admin/extensions/fetchExtensions',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/extensions');
      return data.extensions || [];
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Upload an extension
 */
export const uploadExtension = createAsyncThunk(
  'admin/extensions/uploadExtension',
  async (file, { extra: { fetch }, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await fetch('/api/admin/extensions/upload', {
        method: 'POST',
        body: formData,
      });
      return data.extension;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Upgrade an extension
 */
export const upgradeExtension = createAsyncThunk(
  'admin/extensions/upgradeExtension',
  async ({ id, data }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data: responseData } = await fetch(`/api/admin/extensions/${id}`, {
        method: 'PATCH',
        body: data,
      });
      return responseData.extension;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Toggle extension status
 */
export const toggleExtensionStatus = createAsyncThunk(
  'admin/extensions/toggleStatus',
  async ({ id, isActive }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/extensions/${id}/status`, {
        method: 'PATCH',
        body: { is_active: isActive },
      });
      return data.extension;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);

/**
 * Uninstall extension
 */
export const uninstallExtension = createAsyncThunk(
  'admin/extensions/uninstall',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/admin/extensions/${id}`, {
        method: 'DELETE',
      });
      return id;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);
