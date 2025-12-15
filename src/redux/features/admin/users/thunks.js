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
  deleteUserStart,
  deleteUserSuccess,
  deleteUserError,
  updateUserStatusStart,
  updateUserStatusSuccess,
  updateUserStatusError,
  createUserStart,
  createUserSuccess,
  createUserError,
  updateUserByIdStart,
  updateUserByIdSuccess,
  updateUserByIdError,
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
        status = '',
      } = options || {};

      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);
      if (role) params.append('role', role);
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
 * Delete a user
 *
 * @param {string} userId - User ID to delete
 * @returns {Function} Redux thunk action
 */
export function deleteUser(userId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(deleteUserStart());

    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      dispatch(deleteUserSuccess(userId));

      return { success: true };
    } catch (error) {
      dispatch(deleteUserError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update user status (activate/deactivate)
 *
 * @param {string} userId - User ID
 * @param {boolean} isActive - New active status
 * @returns {Function} Redux thunk action
 */
export function updateUserStatus(userId, isActive) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(updateUserStatusStart());

    try {
      const { data } = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      dispatch(updateUserStatusSuccess(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      dispatch(updateUserStatusError(error.message));

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
        body: JSON.stringify(userData),
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
        body: JSON.stringify(userData),
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
