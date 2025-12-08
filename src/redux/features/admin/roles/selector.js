/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get all roles
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of role objects
 */
export const getRoles = state => state.admin.roles.roles;

/**
 * Get roles pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Pagination object
 */
export const getRolesPagination = state => state.admin.roles.pagination;

/**
 * Get roles loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if roles are loading
 */
export const getRolesLoading = state => state.admin.roles.loading;

/**
 * Get roles error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getRolesError = state => state.admin.roles.error;

/**
 * Get role by ID
 *
 * @param {Object} state - Redux state
 * @param {string} id - Role ID
 * @returns {Object|undefined} Role object or undefined
 */
export const getRoleById = (state, id) =>
  state.admin.roles.roles.find(role => role.id === id);
