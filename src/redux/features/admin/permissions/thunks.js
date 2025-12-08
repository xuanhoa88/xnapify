/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  fetchPermissionsStart,
  fetchPermissionsSuccess,
  fetchPermissionsError,
  deletePermissionStart,
  deletePermissionSuccess,
  deletePermissionError,
  createPermissionStart,
  createPermissionSuccess,
  createPermissionError,
  updatePermissionStart,
  updatePermissionSuccess,
  updatePermissionError,
} from './slice';

/**
 * Permissions Thunks
 *
 * Async thunk actions for permissions CRUD operations.
 */

/**
 * Fetch all permissions
 *
 * @param {Object} options - Query parameters
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @returns {Function} Redux thunk action
 */
export function fetchPermissions(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchPermissionsStart());

    try {
      const { page = 1, limit = 100, search = '' } = options || {};

      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);

      const { data } = await fetch(
        `/api/admin/permissions?${params.toString()}`,
      );

      dispatch(fetchPermissionsSuccess(data));

      return { success: true, data };
    } catch (error) {
      dispatch(fetchPermissionsError(error.message));

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
    dispatch(deletePermissionStart());

    try {
      await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'DELETE',
      });

      dispatch(deletePermissionSuccess(permissionId));

      return { success: true };
    } catch (error) {
      dispatch(deletePermissionError(error.message));

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
    dispatch(createPermissionStart());

    try {
      const { data } = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionData),
      });

      dispatch(createPermissionSuccess(data.permission));

      return { success: true, permission: data.permission };
    } catch (error) {
      dispatch(createPermissionError(error.message));

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
    dispatch(updatePermissionStart());

    try {
      const { data } = await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionData),
      });

      dispatch(updatePermissionSuccess(data.permission));

      return { success: true, permission: data.permission };
    } catch (error) {
      dispatch(updatePermissionError(error.message));

      return { success: false, error: error.message };
    }
  };
}
