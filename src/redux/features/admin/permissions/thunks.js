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
 * @param {string} options.resource - Filter by resource
 * @param {string} options.status - Filter by status: 'active' | 'inactive' | ''
 * @returns {Function} Redux thunk action
 */
export function fetchPermissions(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchPermissionsStart());

    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        resource = '',
        status = '',
      } = options || {};

      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);
      if (resource) params.append('resource', resource);
      if (status) params.append('status', status);

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
 * Fetch unique resources for filter dropdown
 *
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Function} Redux thunk action
 */
export function fetchPermissionResources({
  search = '',
  page = 1,
  limit = 10,
} = {}) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (search) params.append('search', search);

      const { data } = await fetch(
        `/api/admin/permissions/resources?${params.toString()}`,
      );
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch permission by ID
 *
 * @param {string} permissionId - Permission ID
 * @returns {Function} Redux thunk action
 */
export function fetchPermissionById(permissionId) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/permissions/${permissionId}`);
      return { success: true, data };
    } catch (error) {
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
 * @param {string} permissionData.resource - Resource name
 * @param {string} permissionData.action - Action name
 * @param {string} permissionData.description - Permission description
 * @param {boolean} [permissionData.is_active] - Whether permission is active
 * @returns {Function} Redux thunk action
 */
export function createPermission(permissionData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(createPermissionStart());

    try {
      const { data } = await fetch('/api/admin/permissions', {
        method: 'POST',
        body: permissionData,
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
        body: permissionData,
      });

      dispatch(updatePermissionSuccess(data.permission));

      return { success: true, permission: data.permission };
    } catch (error) {
      dispatch(updatePermissionError(error.message));

      return { success: false, error: error.message };
    }
  };
}
