/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Permissions Thunks
 *
 * Async thunk actions for permissions CRUD operations.
 */

/**
 * Fetch all permissions
 */
export const fetchPermissions = createAsyncThunk(
  'admin/permissions/fetchPermissions',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { page = 1, limit = 100, search = '', status = '' } = options || {};

      const { data } = await fetch('/api/admin/permissions', {
        query: {
          page,
          limit,
          search: search || undefined,
          status: status || undefined,
        },
      });

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch permission by ID
 */
export const fetchPermissionById = createAsyncThunk(
  'admin/permissions/fetchPermissionById',
  async (permissionId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/permissions/${permissionId}`);
      return data.permission;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new permission
 */
export const createPermission = createAsyncThunk(
  'admin/permissions/createPermission',
  async (permissionData, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/permissions', {
        method: 'POST',
        body: permissionData,
      });
      return data.permission;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Update a permission
 */
export const updatePermission = createAsyncThunk(
  'admin/permissions/updatePermission',
  async (
    { permissionId, permissionData },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'PUT',
        body: permissionData,
      });
      return data.permission;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Bulk update permission status
 */
export const bulkUpdatePermissionStatus = createAsyncThunk(
  'admin/permissions/bulkUpdatePermissionStatus',
  async ({ ids, isActive }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/permissions/status', {
        method: 'PATCH',
        body: { ids, state: isActive ? 'active' : 'inactive' },
      });
      return { permissions: data.permissions, updated: data.updated };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Bulk delete permissions
 */
export const bulkDeletePermissions = createAsyncThunk(
  'admin/permissions/bulkDeletePermissions',
  async (ids, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/permissions', {
        method: 'DELETE',
        body: { ids },
      });
      return {
        deletedIds: data.deletedIds,
        deleted: data.deleted,
        protectedIds: data.protectedIds,
      };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
