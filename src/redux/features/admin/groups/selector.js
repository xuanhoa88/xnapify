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

/**
 * Get roles for a specific group
 *
 * @param {Object} state - Redux state
 * @param {string} groupId - Group ID
 * @returns {Array} Array of role objects for the group
 */
export const getGroupRoles = (state, groupId) => {
  const group = state.admin.groups.items.find(g => g.id === groupId);
  return (group && group.roles) || [];
};

/**
 * Get groups that have at least one role assigned
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of group objects with roles
 */
export const getGroupsWithRoles = state =>
  state.admin.groups.items.filter(
    group => group.roles && group.roles.length > 0,
  );

/**
 * Get groups filtered by role name
 *
 * @param {Object} state - Redux state
 * @param {string} roleName - Role name to filter by
 * @returns {Array} Array of group objects with the specified role
 */
export const getGroupsByRoleName = (state, roleName) =>
  state.admin.groups.items.filter(
    group =>
      group.roles &&
      group.roles.some(
        role => role.name.toLowerCase() === roleName.toLowerCase(),
      ),
  );

/**
 * Get total role count across all groups
 *
 * @param {Object} state - Redux state
 * @returns {number} Total number of group-role assignments
 */
export const getTotalGroupRoleCount = state =>
  state.admin.groups.items.reduce(
    (total, group) =>
      total +
      ((group &&
        (group.roleCount ||
          (Array.isArray(group.roles) ? group.roles.length : 0))) ||
        0),
    0,
  );
