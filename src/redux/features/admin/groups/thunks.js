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
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (type) params.append('type', type);

      const { data } = await fetch(`/api/admin/groups?${params.toString()}`);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
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
 * Clear groups error
 *
 * @returns {Object} Redux action
 */
export function clearGroupsError() {
  return clearError();
}
