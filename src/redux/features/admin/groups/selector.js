/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get all groups
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of group objects
 */
export const getGroups = state => state.admin.groups.items;

/**
 * Get current group
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Current group or null
 */
export const getCurrentGroup = state => state.admin.groups.currentGroup;

/**
 * Get groups pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object} Pagination object
 */
export const getGroupsPagination = state => state.admin.groups.pagination;

/**
 * Get groups loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if groups are loading
 */
export const getGroupsLoading = state => state.admin.groups.loading;

/**
 * Get groups error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getGroupsError = state => state.admin.groups.error;

/**
 * Get group by ID
 *
 * @param {Object} state - Redux state
 * @param {string} groupId - Group ID
 * @returns {Object|undefined} Group object or undefined
 */
export const getGroupById = (state, groupId) =>
  state.admin.groups.items.find(group => group.id === groupId);
