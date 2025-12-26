/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  fetchUsersStart,
  fetchUsersSuccess,
  fetchUsersError,
  fetchUserByIdStart,
  fetchUserByIdSuccess,
  fetchUserByIdError,
  createUserStart,
  createUserSuccess,
  createUserError,
  updateUserByIdStart,
  updateUserByIdSuccess,
  updateUserByIdError,
  fetchUserPermissionsStart,
  fetchUserPermissionsSuccess,
  fetchUserPermissionsError,
  clearUserPermissions,
  bulkUpdateStatusStart,
  bulkUpdateStatusSuccess,
  bulkUpdateStatusError,
  bulkDeleteStart,
  bulkDeleteSuccess,
  bulkDeleteError,
} from './slice';

/**
 * Users Thunks
 *
 * Async thunk actions for admin users CRUD operations.
 */

/**
 * Fetch user by ID with full details
 *
 * @param {string} userId - User ID
 * @returns {Function} Redux thunk action
 */
export function fetchUserById(userId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchUserByIdStart());

    try {
      const { data } = await fetch(`/api/admin/users/${userId}`);

      dispatch(fetchUserByIdSuccess(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      dispatch(fetchUserByIdError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch all users with pagination and filters
 *
 * @param {Object} options - Query parameters
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.role - Filter by role
 * @param {string} options.status - Filter by status
 * @returns {Function} Redux thunk action
 */
export function fetchUsers(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchUsersStart());

    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        group = '',
        status = '',
      } = options || {};

      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (group) params.append('group', group);
      if (status) params.append('status', status);

      const { data } = await fetch(
        `/api/admin/users/list?${params.toString()}`,
      );

      dispatch(fetchUsersSuccess(data));

      return { success: true, data };
    } catch (error) {
      dispatch(fetchUsersError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Create a new user
 *
 * @param {Object} userData - User data
 * @returns {Function} Redux thunk action
 */
export function createUser(userData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(createUserStart());

    try {
      const { data } = await fetch('/api/admin/users', {
        method: 'POST',
        body: userData,
      });

      dispatch(createUserSuccess(data.user));

      // Refresh the list to show the new user
      dispatch(fetchUsers());

      return { success: true, data: data.user };
    } catch (error) {
      dispatch(createUserError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update an existing user
 *
 * @param {string} userId - User ID
 * @param {Object} userData - User data to update
 * @returns {Function} Redux thunk action
 */
export function updateUser(userId, userData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(updateUserByIdStart());

    try {
      const { data } = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: userData,
      });

      dispatch(updateUserByIdSuccess(data.user));

      // Refresh the list to show updated data
      dispatch(fetchUsers());

      return { success: true, data: data.user };
    } catch (error) {
      dispatch(updateUserByIdError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Generate a random secure password
 *
 * @param {Object} options - Generation options
 * @param {number} options.length - Password length (default 16)
 * @param {boolean} options.includeSymbols - Include symbols (default true)
 * @returns {Function} Redux thunk action
 */
export function generatePassword(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { length = 16, includeSymbols = true } = options;

      const params = new URLSearchParams();
      if (length) params.append('length', length);
      if (!includeSymbols) params.append('includeSymbols', 'false');

      const { data } = await fetch(
        `/api/admin/users/generate-password?${params.toString()}`,
      );

      return { success: true, password: data.password };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

// ========================================================================
// RBAC THUNKS
// ========================================================================

/**
 * Assign roles to a user
 *
 * @param {string} userId - User ID
 * @param {string[]} roleNames - Array of role names
 * @returns {Function} Redux thunk action
 */
export function assignRolesToUser(userId, roleNames) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PUT',
        body: { role_names: roleNames },
      });

      // Refresh user data
      dispatch(fetchUserById(userId));

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

/**
 * Assign groups to a user
 *
 * @param {string} userId - User ID
 * @param {string[]} groupIds - Array of group IDs
 * @returns {Function} Redux thunk action
 */
export function assignGroupsToUser(userId, groupIds) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/groups`, {
        method: 'PUT',
        body: { group_ids: groupIds },
      });

      // Refresh user data
      dispatch(fetchUserById(userId));

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch user's effective permissions
 *
 * @param {string} userId - User ID
 * @returns {Function} Redux thunk action
 */
export function fetchUserPermissions(userId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchUserPermissionsStart(userId));

    try {
      const { data } = await fetch(`/api/admin/users/${userId}/permissions`);
      const permissions = data.permissions || [];

      dispatch(fetchUserPermissionsSuccess(permissions));

      return { success: true, permissions };
    } catch (error) {
      dispatch(fetchUserPermissionsError(error.message));

      return { success: false, permissions: [], error: error.message };
    }
  };
}

/**
 * Clear user permissions from state
 *
 * @returns {Function} Redux thunk action
 */
export function clearPermissions() {
  return async dispatch => {
    dispatch(clearUserPermissions());
  };
}

/**
 * Fetch user's roles
 *
 * @param {string} userId - User ID
 * @returns {Function} Redux thunk action
 */
export function fetchUserRoles(userId) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/users/${userId}/roles`);

      return {
        success: true,
        user: data.user,
        roles: data.roles || [],
      };
    } catch (error) {
      return {
        success: false,
        roles: [],
        error: error.message,
      };
    }
  };
}

/**
 * Bulk update user status
 *
 * @param {string[]} ids - Array of user IDs to update
 * @param {boolean} isActive - New status value
 * @returns {Function} Redux thunk action
 */
export function bulkUpdateUserStatus(ids, isActive) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(bulkUpdateStatusStart());

    try {
      const { data } = await fetch('/api/admin/users/status', {
        method: 'PATCH',
        body: { ids, is_active: isActive },
      });

      dispatch(bulkUpdateStatusSuccess(data.users));

      return { success: true, updated: data.updated };
    } catch (error) {
      dispatch(bulkUpdateStatusError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Bulk delete users
 *
 * @param {string[]} ids - Array of user IDs to delete
 * @returns {Function} Redux thunk action
 */
export function bulkDeleteUsers(ids) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(bulkDeleteStart());

    try {
      const { data } = await fetch('/api/admin/users', {
        method: 'DELETE',
        body: { ids },
      });

      dispatch(bulkDeleteSuccess(data.deletedIds));

      return {
        success: true,
        deleted: data.deleted,
      };
    } catch (error) {
      dispatch(bulkDeleteError(error.message));

      return { success: false, error: error.message };
    }
  };
}
