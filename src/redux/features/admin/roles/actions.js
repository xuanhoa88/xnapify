/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_ROLES_START,
  FETCH_ROLES_SUCCESS,
  FETCH_ROLES_ERROR,
  DELETE_ROLE_START,
  DELETE_ROLE_SUCCESS,
  DELETE_ROLE_ERROR,
  CREATE_ROLE_START,
  CREATE_ROLE_SUCCESS,
  CREATE_ROLE_ERROR,
  UPDATE_ROLE_START,
  UPDATE_ROLE_SUCCESS,
  UPDATE_ROLE_ERROR,
} from './constants';

/**
 * Fetch all roles
 *
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.search - Search term
 * @returns {Function} Redux thunk action
 */
export function fetchRoles({ page = 1, limit = 100, search = '' } = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: FETCH_ROLES_START });

    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);

      const { data } = await fetch(`/api/admin/roles?${params.toString()}`);

      dispatch({
        type: FETCH_ROLES_SUCCESS,
        payload: data,
      });

      return { success: true, data };
    } catch (error) {
      dispatch({
        type: FETCH_ROLES_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Delete a role
 *
 * @param {string} roleId - Role ID to delete
 * @returns {Function} Redux thunk action
 */
export function deleteRole(roleId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: DELETE_ROLE_START, payload: roleId });

    try {
      await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });

      dispatch({
        type: DELETE_ROLE_SUCCESS,
        payload: roleId,
      });

      return { success: true };
    } catch (error) {
      dispatch({
        type: DELETE_ROLE_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Create a new role
 *
 * @param {Object} roleData - Role data
 * @param {string} roleData.name - Role name
 * @param {string} roleData.description - Role description
 * @returns {Function} Redux thunk action
 */
export function createRole(roleData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: CREATE_ROLE_START });

    try {
      const { data } = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });

      dispatch({
        type: CREATE_ROLE_SUCCESS,
        payload: data.role,
      });

      return { success: true, role: data.role };
    } catch (error) {
      dispatch({
        type: CREATE_ROLE_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update a role
 *
 * @param {string} roleId - Role ID
 * @param {Object} roleData - Updated role data
 * @returns {Function} Redux thunk action
 */
export function updateRole(roleId, roleData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: UPDATE_ROLE_START });

    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });

      dispatch({
        type: UPDATE_ROLE_SUCCESS,
        payload: data.role,
      });

      return { success: true, role: data.role };
    } catch (error) {
      dispatch({
        type: UPDATE_ROLE_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}
