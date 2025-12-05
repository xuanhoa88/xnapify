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
export function getUsers(state) {
  return state.admin.users.users;
}

/**
 * Get users pagination
 *
 * @param {Object} state - Redux state
 * @returns {Object} Pagination object
 */
export function getUsersPagination(state) {
  return state.admin.users.pagination;
}

/**
 * Get users loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if users are loading
 */
export function getUsersLoading(state) {
  return state.admin.users.loading;
}

/**
 * Get users error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export function getUsersError(state) {
  return state.admin.users.error;
}

/**
 * Get user by ID
 *
 * @param {Object} state - Redux state
 * @param {string} id - User ID
 * @returns {Object|undefined} User object or undefined
 */
export function getUserById(state, id) {
  return state.admin.users.users.find(user => user.id === id);
}
