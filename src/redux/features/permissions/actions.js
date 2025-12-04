/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_PERMISSIONS_START,
  FETCH_PERMISSIONS_SUCCESS,
  FETCH_PERMISSIONS_ERROR,
  DELETE_PERMISSION_START,
  DELETE_PERMISSION_SUCCESS,
  DELETE_PERMISSION_ERROR,
  CREATE_PERMISSION_START,
  CREATE_PERMISSION_SUCCESS,
  CREATE_PERMISSION_ERROR,
  UPDATE_PERMISSION_START,
  UPDATE_PERMISSION_SUCCESS,
  UPDATE_PERMISSION_ERROR,
} from './constants';

/**
 * Fetch all permissions
 *
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.search - Search term
 * @returns {Function} Redux thunk action
 */
export function fetchPermissions({ page = 1, limit = 100, search = '' } = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: FETCH_PERMISSIONS_START });

    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);

      const { data } = await fetch(
        `/api/admin/permissions?${params.toString()}`,
      );

      dispatch({
        type: FETCH_PERMISSIONS_SUCCESS,
        payload: data,
      });

      return { success: true, data };
    } catch (error) {
      dispatch({
        type: FETCH_PERMISSIONS_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Delete a permission
 *
 * @param {string} permissionId - Permission ID to delete
 * @returns {Function} Redux thunk action
 */
export function deletePermission(permissionId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: DELETE_PERMISSION_START, payload: permissionId });

    try {
      await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'DELETE',
      });

      dispatch({
        type: DELETE_PERMISSION_SUCCESS,
        payload: permissionId,
      });

      return { success: true };
    } catch (error) {
      dispatch({
        type: DELETE_PERMISSION_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Create a new permission
 *
 * @param {Object} permissionData - Permission data
 * @param {string} permissionData.name - Permission name
 * @param {string} permissionData.resource - Resource name
 * @param {string} permissionData.action - Action name
 * @param {string} permissionData.description - Permission description
 * @returns {Function} Redux thunk action
 */
export function createPermission(permissionData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: CREATE_PERMISSION_START });

    try {
      const { data } = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionData),
      });

      dispatch({
        type: CREATE_PERMISSION_SUCCESS,
        payload: data.permission,
      });

      return { success: true, permission: data.permission };
    } catch (error) {
      dispatch({
        type: CREATE_PERMISSION_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update a permission
 *
 * @param {string} permissionId - Permission ID
 * @param {Object} permissionData - Updated permission data
 * @returns {Function} Redux thunk action
 */
export function updatePermission(permissionId, permissionData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: UPDATE_PERMISSION_START });

    try {
      const { data } = await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionData),
      });

      dispatch({
        type: UPDATE_PERMISSION_SUCCESS,
        payload: data.permission,
      });

      return { success: true, permission: data.permission };
    } catch (error) {
      dispatch({
        type: UPDATE_PERMISSION_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}
