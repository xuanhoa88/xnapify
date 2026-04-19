/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Groups Thunks
 *
 * Async thunk actions for groups CRUD operations.
 */

/**
 * Fetch all groups with pagination
 */
export const fetchGroups = createAsyncThunk(
  'admin/groups/fetchGroups',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        type = '',
        role = '',
      } = options;

      const { data } = await fetch('/api/admin/groups/list', {
        query: {
          page,
          limit,
          search,
          category,
          type,
          role,
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
 * Fetch group by ID
 */
export const fetchGroupById = createAsyncThunk(
  'admin/groups/fetchGroupById',
  async (groupId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`);
      return data.group;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new group
 */
export const createGroup = createAsyncThunk(
  'admin/groups/createGroup',
  async (groupData, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/groups', {
        method: 'POST',
        body: groupData,
      });
      return data.group;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Update group by ID
 */
export const updateGroup = createAsyncThunk(
  'admin/groups/updateGroup',
  async ({ groupId, groupData }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'PUT',
        body: groupData,
      });
      return data.group;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Delete group by ID
 */
export const deleteGroup = createAsyncThunk(
  'admin/groups/deleteGroup',
  async (groupId, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
      });
      return groupId;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch group users
 */
export const fetchGroupUsers = createAsyncThunk(
  'admin/groups/fetchGroupUsers',
  async (
    { groupId, page = 1, limit = 10, search = '' },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/users`, {
        query: {
          page,
          limit,
          search,
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
 * Assign roles to a group
 */
export const assignRolesToGroup = createAsyncThunk(
  'admin/groups/assignRolesToGroup',
  async ({ groupId, roleNames }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/roles`, {
        method: 'PUT',
        body: { role_names: roleNames },
      });
      return data.group;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch group permissions
 */
export const fetchGroupPermissions = createAsyncThunk(
  'admin/groups/fetchGroupPermissions',
  async (groupId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/permissions`);
      return {
        permissions: data.permissions || [],
        roleDetails: data.roleDetails || [],
      };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch group's roles
 */
export const fetchGroupRoles = createAsyncThunk(
  'admin/groups/fetchGroupRoles',
  async (groupId, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/roles`);
      return {
        group: data.group,
        roles: data.roles || [],
      };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
