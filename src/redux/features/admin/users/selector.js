/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get all users
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of user objects
 */
export const getUsers = state => state.admin.users.users;

/**
 * Get users pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Pagination object
 */
export const getUsersPagination = state => state.admin.users.pagination;

/**
 * Get users loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if users are loading
 */
export const getUsersLoading = state => state.admin.users.loading;

/**
 * Get users error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getUsersError = state => state.admin.users.error;

/**
 * Get user by ID
 *
 * @param {Object} state - Redux state
 * @param {string} id - User ID
 * @returns {Object|undefined} User object or undefined
 */
export const getUserById = (state, id) =>
  state.admin.users.users.find(user => user.id === id);

/**
 * Get user permissions
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of permission strings
 */
export const getUserPermissions = state => state.admin.users.permissions.items;

/**
 * Get user permissions loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if permissions are loading
 */
export const getUserPermissionsLoading = state =>
  state.admin.users.permissions.loading;

/**
 * Get user permissions error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getUserPermissionsError = state =>
  state.admin.users.permissions.error;
