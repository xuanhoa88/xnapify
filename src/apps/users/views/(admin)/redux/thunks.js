/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Users Thunks
 *
 * Async thunk actions for admin users CRUD operations.
 */

/**
 * Fetch all users with pagination and filters
 */
export const fetchUsers = createAsyncThunk(
  'admin/users/fetchUsers',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        group = '',
        status = '',
      } = options || {};

      const { data } = await fetch('/api/admin/users/list', {
        query: {
          page,
          limit,
          search: search || undefined,
          role: role || undefined,
          group: group || undefined,
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
 * Fetch user by ID with full details
 */
export const fetchUserById = createAsyncThunk(
  'admin/users/fetchUserById',
  async (userId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}`);
      return data.user;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new user
 */
export const createUser = createAsyncThunk(
  'admin/users/createUser',
  async (userData, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/users', {
        method: 'POST',
        body: userData,
      });

      // Refresh the list to show the new user
      dispatch(fetchUsers());

      return data.user;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Update an existing user
 */
export const updateUser = createAsyncThunk(
  'admin/users/updateUser',
  async (
    { userId, userData },
    { dispatch, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: userData,
      });

      // Refresh the list to show updated data
      dispatch(fetchUsers());

      return data.user;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

// ========================================================================
// RBAC THUNKS
// ========================================================================

/**
 * Assign roles to a user
 */
export const assignRolesToUser = createAsyncThunk(
  'admin/users/assignRolesToUser',
  async ({ userId, roleNames }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PUT',
        body: { role_names: roleNames },
      });

      return data.user;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Assign groups to a user
 */
export const assignGroupsToUser = createAsyncThunk(
  'admin/users/assignGroupsToUser',
  async ({ userId, groupIds }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/groups`, {
        method: 'PUT',
        body: { group_ids: groupIds },
      });

      return data.user;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch user's effective permissions
 */
export const fetchUserPermissions = createAsyncThunk(
  'admin/users/fetchUserPermissions',
  async (userId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/permissions`);
      return data.permissions || [];
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Bulk update user status
 */
export const bulkUpdateUserStatus = createAsyncThunk(
  'admin/users/bulkUpdateUserStatus',
  async ({ ids, isActive }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/users/status', {
        method: 'PATCH',
        body: { ids, state: isActive ? 'active' : 'inactive' },
      });

      return data.users;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Bulk delete users
 */
export const bulkDeleteUsers = createAsyncThunk(
  'admin/users/bulkDeleteUsers',
  async (ids, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/users', {
        method: 'DELETE',
        body: { ids },
      });

      return data.deletedIds;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

// ========================================================================
// API KEY THUNKS
// ========================================================================

/**
 * Fetch API keys for a user
 */
export const fetchApiKeys = createAsyncThunk(
  'admin/users/fetchApiKeys',
  async (userId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/api-keys`);
      return data.keys || [];
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new API key for a user
 */
export const createApiKey = createAsyncThunk(
  'admin/users/createApiKey',
  async (
    { userId, name, expiresIn, scopes },
    { dispatch, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/api-keys`, {
        method: 'POST',
        body: { name, expiresIn, scopes },
      });

      dispatch(fetchApiKeys(userId));

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Revoke an API key
 */
export const revokeApiKey = createAsyncThunk(
  'admin/users/revokeApiKey',
  async (
    { userId, keyId },
    { dispatch, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      await fetch(`/api/admin/users/${userId}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      dispatch(fetchApiKeys(userId));

      return keyId;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
