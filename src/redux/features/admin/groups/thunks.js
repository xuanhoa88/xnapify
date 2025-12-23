/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  fetchGroupsStart,
  fetchGroupsSuccess,
  fetchGroupsError,
  fetchGroupStart,
  fetchGroupSuccess,
  fetchGroupError,
  createGroupStart,
  createGroupSuccess,
  createGroupError,
  updateGroupStart,
  updateGroupSuccess,
  updateGroupError,
  deleteGroupStart,
  deleteGroupSuccess,
  deleteGroupError,
  clearGroupsError as clearError,
} from './slice';

/**
 * Groups Thunks
 *
 * Async thunk actions for groups CRUD operations.
 */

/**
 * Fetch all groups with pagination
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.search - Search term (optional)
 * @param {string} options.category - Filter by category (optional)
 * @param {string} options.type - Filter by type (optional)
 * @returns {Function} Redux thunk action
 */
export function fetchGroups(options = {}) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchGroupsStart());

    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        type = '',
        role = '',
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (type) params.append('type', type);
      if (role) params.append('role', role);

      const { data } = await fetch(
        `/api/admin/groups/list?${params.toString()}`,
      );

      dispatch(
        fetchGroupsSuccess({
          groups: data.groups,
          pagination: data.pagination,
        }),
      );

      return { success: true, data };
    } catch (error) {
      dispatch(fetchGroupsError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch group by ID
 *
 * @param {string} groupId - Group ID
 * @returns {Function} Redux thunk action
 */
export function fetchGroupById(groupId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchGroupStart());

    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`);

      dispatch(fetchGroupSuccess(data.group));

      return { success: true, group: data.group };
    } catch (error) {
      dispatch(fetchGroupError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Create a new group
 *
 * @param {Object} groupData - Group data
 * @param {string} groupData.name - Group name
 * @param {string} groupData.description - Group description (optional)
 * @param {string} groupData.category - Group category (optional)
 * @param {string} groupData.type - Group type (optional)
 * @returns {Function} Redux thunk action
 */
export function createGroup(groupData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(createGroupStart());

    try {
      const { data } = await fetch('/api/admin/groups', {
        method: 'POST',
        body: groupData,
      });

      dispatch(createGroupSuccess(data.group));

      return { success: true, group: data.group };
    } catch (error) {
      dispatch(createGroupError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update group by ID
 *
 * @param {string} groupId - Group ID
 * @param {Object} updateData - Data to update
 * @returns {Function} Redux thunk action
 */
export function updateGroup(groupId, updateData) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(updateGroupStart());

    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'PUT',
        body: updateData,
      });

      dispatch(updateGroupSuccess(data.group));

      return { success: true, group: data.group };
    } catch (error) {
      dispatch(updateGroupError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Delete group by ID
 *
 * @param {string} groupId - Group ID
 * @returns {Function} Redux thunk action
 */
export function deleteGroup(groupId) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(deleteGroupStart());

    try {
      await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
      });

      dispatch(deleteGroupSuccess(groupId));

      return { success: true };
    } catch (error) {
      dispatch(deleteGroupError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch group users
 *
 * @param {string} groupId - Group ID
 * @param {Object} options - Pagination options
 * @returns {Function} Redux thunk action
 */
export function fetchGroupUsers(groupId, options = {}) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { page = 1, limit = 10, search = '' } = options;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append('search', search);
      }

      const { data } = await fetch(
        `/api/admin/groups/${groupId}/users?${params.toString()}`,
      );

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

/**
 * Clear groups error
 *
 * @returns {Object} Redux action
 */
export function clearGroupsError() {
  return clearError();
}

/**
 * Assign roles to a group
 *
 * @param {string} groupId - Group ID
 * @param {string[]} roleNames - Array of role names to assign
 * @returns {Function} Redux thunk action
 */
export function assignRolesToGroup(groupId, roleNames) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/roles`, {
        method: 'POST',
        body: { roles: roleNames },
      });

      // Update the group in state with new roles
      if (data.group) {
        dispatch(updateGroupSuccess(data.group));
      }

      return { success: true, group: data.group };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

/**
 * Fetch group permissions
 *
 * Gets all effective permissions for a group from its assigned roles.
 *
 * @param {string} groupId - Group ID
 * @returns {Function} Redux thunk action
 */
export function fetchGroupPermissions(groupId) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/permissions`);

      return {
        success: true,
        permissions: data.permissions || [],
        roleDetails: data.roleDetails || [],
      };
    } catch (error) {
      return {
        success: false,
        permissions: [],
        roleDetails: [],
        error: error.message,
      };
    }
  };
}

/**
 * Fetch group's roles
 *
 * Gets all roles assigned to a group with their permissions.
 *
 * @param {string} groupId - Group ID
 * @returns {Function} Redux thunk action
 */
export function fetchGroupRoles(groupId) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}/roles`);

      return {
        success: true,
        group: data.group,
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
