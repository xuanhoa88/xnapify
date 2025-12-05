/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Check if user is authenticated
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if user is logged in
 */
export const isAuthenticated = state => state.user && !!state.user.id;

/**
 * Check if user has admin role
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if user is admin
 */
export const isAdmin = state => {
  const { user } = state;
  if (!user) return false;
  return user.role === 'admin' || user.is_admin === true;
};

/**
 * Get current user
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} User object or null if not authenticated
 */
export const getCurrentUser = state => state.user;

/**
 * Get user ID
 *
 * @param {Object} state - Redux state
 * @returns {string|null} User ID or null
 */
export const getCurrentUserId = state => (state.user && state.user.id) || null;

/**
 * Get user email
 *
 * @param {Object} state - Redux state
 * @returns {string|null} User email or null
 */
export const getCurrentUserEmail = state =>
  (state.user && state.user.email) || null;

/**
 * Get user display name
 *
 * @param {Object} state - Redux state
 * @returns {string|null} User display name or null
 */
export const getCurrentUserDisplayName = state => {
  if (!state.user) return null;
  // Check top-level display_name first (API response format)
  if (state.user.display_name) return state.user.display_name;
  // Check nested profile (just in case structure changes)
  if (state.user.profile && state.user.profile.display_name)
    return state.user.profile.display_name;
  // Fallback to email
  return state.user.email;
};
