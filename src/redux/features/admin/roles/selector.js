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
export function getRoles(state) {
  return state.admin.roles.roles;
}

/**
 * Get current role
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Current role or null
 */
export function getCurrentRole(state) {
  return state.admin.roles.currentRole;
}

/**
 * Get roles pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object} Pagination object
 */
export function getRolesPagination(state) {
  return state.admin.roles.pagination;
}

/**
 * Get roles loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if roles are loading
 */
export function getRolesLoading(state) {
  return state.admin.roles.loading;
}

/**
 * Get roles error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export function getRolesError(state) {
  return state.admin.roles.error;
}

/**
 * Get role by ID
 *
 * @param {Object} state - Redux state
 * @param {string} id - Role ID
 * @returns {Object|undefined} Role object or undefined
 */
export function getRoleById(state, id) {
  return state.admin.roles.roles.find(role => role.id === id);
}
