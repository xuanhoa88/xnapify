/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_GROUPS_START,
  FETCH_GROUPS_SUCCESS,
  FETCH_GROUPS_ERROR,
  FETCH_GROUP_START,
  FETCH_GROUP_SUCCESS,
  FETCH_GROUP_ERROR,
  CREATE_GROUP_START,
  CREATE_GROUP_SUCCESS,
  CREATE_GROUP_ERROR,
  UPDATE_GROUP_START,
  UPDATE_GROUP_SUCCESS,
  UPDATE_GROUP_ERROR,
  DELETE_GROUP_START,
  DELETE_GROUP_SUCCESS,
  DELETE_GROUP_ERROR,
  CLEAR_GROUPS_ERROR,
} from './constants';

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
    dispatch({ type: FETCH_GROUPS_START });

    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        type = '',
      } = options;

      // Build query string
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (type) params.append('type', type);

      const { data } = await fetch(`/api/admin/groups?${params.toString()}`);

      dispatch({
        type: FETCH_GROUPS_SUCCESS,
        payload: {
          groups: data.groups,
          pagination: data.pagination,
        },
      });

      return { success: true, data };
    } catch (error) {
      dispatch({
        type: FETCH_GROUPS_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: FETCH_GROUP_START });

    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`);

      dispatch({
        type: FETCH_GROUP_SUCCESS,
        payload: data.group,
      });

      return { success: true, group: data.group };
    } catch (error) {
      dispatch({
        type: FETCH_GROUP_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: CREATE_GROUP_START });

    try {
      const { data } = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      });

      dispatch({
        type: CREATE_GROUP_SUCCESS,
        payload: data.group,
      });

      return { success: true, group: data.group };
    } catch (error) {
      dispatch({
        type: CREATE_GROUP_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: UPDATE_GROUP_START });

    try {
      const { data } = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      dispatch({
        type: UPDATE_GROUP_SUCCESS,
        payload: data.group,
      });

      return { success: true, group: data.group };
    } catch (error) {
      dispatch({
        type: UPDATE_GROUP_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: DELETE_GROUP_START });

    try {
      await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
      });

      dispatch({
        type: DELETE_GROUP_SUCCESS,
        payload: groupId,
      });

      return { success: true };
    } catch (error) {
      dispatch({
        type: DELETE_GROUP_ERROR,
        payload: error.message,
      });

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
  return {
    type: CLEAR_GROUPS_ERROR,
  };
}
