/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get all permissions
 *
 * @param {Object} state - Redux state
 * @returns {Array} Array of permission objects
 */
export const getPermissions = state => state.admin.permissions.permissions;

/**
 * Get permissions pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Pagination object
 */
export const getPermissionsPagination = state =>
  state.admin.permissions.pagination;

/**
 * Get permissions loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if permissions are loading
 */
export const getPermissionsLoading = state => state.admin.permissions.loading;

/**
 * Get permissions error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getPermissionsError = state => state.admin.permissions.error;

/**
 * Get permission by ID
 *
 * @param {Object} state - Redux state
 * @param {string} id - Permission ID
 * @returns {Object|undefined} Permission object or undefined
 */
export const getPermissionById = (state, id) =>
  state.admin.permissions.permissions.find(permission => permission.id === id);
