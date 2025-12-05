/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_USERS_START,
  FETCH_USERS_SUCCESS,
  FETCH_USERS_ERROR,
  DELETE_USER_START,
  DELETE_USER_SUCCESS,
  DELETE_USER_ERROR,
  UPDATE_USER_STATUS_START,
  UPDATE_USER_STATUS_SUCCESS,
  UPDATE_USER_STATUS_ERROR,
  CREATE_USER_START,
  CREATE_USER_SUCCESS,
  CREATE_USER_ERROR,
  UPDATE_USER_START,
  UPDATE_USER_SUCCESS,
  UPDATE_USER_ERROR,
} from './constants';

/**
 * Fetch all users with pagination and filters
 *
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.search - Search term
 * @param {string} params.role - Filter by role
 * @param {string} params.status - Filter by status
 * @returns {Function} Redux thunk action
 */
export function fetchUsers(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: FETCH_USERS_START });

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

      dispatch({
        type: FETCH_USERS_SUCCESS,
        payload: data,
      });

      return { success: true, data };
    } catch (error) {
      dispatch({
        type: FETCH_USERS_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: DELETE_USER_START, payload: userId });

    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      dispatch({
        type: DELETE_USER_SUCCESS,
        payload: userId,
      });

      return { success: true };
    } catch (error) {
      dispatch({
        type: DELETE_USER_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: UPDATE_USER_STATUS_START });

    try {
      const { data } = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      dispatch({
        type: UPDATE_USER_STATUS_SUCCESS,
        payload: data.user,
      });

      return { success: true, user: data.user };
    } catch (error) {
      dispatch({
        type: UPDATE_USER_STATUS_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Create a new user
 *
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.display_name - Display name
 * @param {string} userData.first_name - First name
 * @param {string} userData.last_name - Last name
 * @param {string} userData.role - User role
 * @param {boolean} userData.is_active - Active status
 * @returns {Function} Redux thunk action
 */
export function createUser(userData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: CREATE_USER_START });

    try {
      const { data } = await fetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      dispatch({
        type: CREATE_USER_SUCCESS,
        payload: data.user,
      });

      // Refresh the list to show the new user
      dispatch(fetchUsers());

      return { success: true, data: data.user };
    } catch (error) {
      dispatch({
        type: CREATE_USER_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update an existing user
 *
 * @param {string} userId - User ID
 * @param {Object} userData - User data to update
 * @param {string} userData.display_name - Display name
 * @param {string} userData.first_name - First name
 * @param {string} userData.last_name - Last name
 * @param {string} userData.role - User role
 * @param {boolean} userData.is_active - Active status
 * @returns {Function} Redux thunk action
 */
export function updateUser(userId, userData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: UPDATE_USER_START });

    try {
      const { data } = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      dispatch({
        type: UPDATE_USER_SUCCESS,
        payload: data.user,
      });

      // Refresh the list to show updated data
      dispatch(fetchUsers());

      return { success: true, data: data.user };
    } catch (error) {
      dispatch({
        type: UPDATE_USER_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}
