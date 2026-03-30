/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Roles Thunks
 *
 * Async thunk actions for roles CRUD operations.
 */

/**
 * Fetch all roles
 */
export const fetchRoles = createAsyncThunk(
  'admin/roles/fetchRoles',
  async (
    { page = 1, limit = 100, search = '' } = {},
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/admin/roles/list', {
        query: {
          page,
          limit,
          search: search || undefined,
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
 * Fetch role by ID
 */
export const fetchRoleById = createAsyncThunk(
  'admin/roles/fetchRoleById',
  async (roleId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}`);
      return data.role;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Delete a role
 */
export const deleteRole = createAsyncThunk(
  'admin/roles/deleteRole',
  async (roleId, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });
      return roleId;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new role
 */
export const createRole = createAsyncThunk(
  'admin/roles/createRole',
  async (roleData, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/roles', {
        method: 'POST',
        body: roleData,
      });
      return data.role;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Update a role
 */
export const updateRole = createAsyncThunk(
  'admin/roles/updateRole',
  async ({ roleId, roleData }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        body: roleData,
      });
      return data.role;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch users assigned to a role
 */
export const fetchRoleUsers = createAsyncThunk(
  'admin/roles/fetchRoleUsers',
  async (
    { roleId, page = 1, limit = 10, search = '' },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}/users`, {
        query: {
          page,
          limit,
          search: search || undefined,
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
 * Fetch groups assigned to a role
 */
export const fetchRoleGroups = createAsyncThunk(
  'admin/roles/fetchRoleGroups',
  async (
    { roleId, page = 1, limit = 10, search = '' },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}/groups`, {
        query: {
          page,
          limit,
          search: search || undefined,
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
 * Fetch permissions assigned to a role
 */
export const fetchRolePermissions = createAsyncThunk(
  'admin/roles/fetchRolePermissions',
  async (roleId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}/permissions`);
      return data.permissions || [];
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
