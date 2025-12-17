/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  fetchRolesStart,
  fetchRolesSuccess,
  fetchRolesError,
  deleteRoleStart,
  deleteRoleSuccess,
  deleteRoleError,
  createRoleStart,
  createRoleSuccess,
  createRoleError,
  updateRoleStart,
  updateRoleSuccess,
  updateRoleError,
} from './slice';

/**
 * Roles Thunks
 *
 * Async thunk actions for roles CRUD operations.
 * Maintains backward compatible return pattern { success, data/error }.
 */

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
    dispatch(fetchRolesStart());

    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);

      const { data } = await fetch(
        `/api/admin/roles/list?${params.toString()}`,
      );

      dispatch(fetchRolesSuccess(data));

      return { success: true, data };
    } catch (error) {
      dispatch(fetchRolesError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch role by ID
 *
 * @param {string} roleId - Role ID
 * @returns {Function} Redux thunk action
 */
export function fetchRoleById(roleId) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}`);

      return { success: true, role: data.role };
    } catch (error) {
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
    dispatch(deleteRoleStart());

    try {
      await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });

      dispatch(deleteRoleSuccess(roleId));

      return { success: true };
    } catch (error) {
      dispatch(deleteRoleError(error.message));

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
    dispatch(createRoleStart());

    try {
      const { data } = await fetch('/api/admin/roles', {
        method: 'POST',
        body: roleData,
      });

      dispatch(createRoleSuccess(data.role));

      return { success: true, role: data.role };
    } catch (error) {
      dispatch(createRoleError(error.message));

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
    dispatch(updateRoleStart());

    try {
      const { data } = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        body: roleData,
      });

      dispatch(updateRoleSuccess(data.role));

      return { success: true, role: data.role };
    } catch (error) {
      dispatch(updateRoleError(error.message));

      return { success: false, error: error.message };
    }
  };
}
