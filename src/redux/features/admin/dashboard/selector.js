/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get dashboard stats
 *
 * @param {Object} state - Redux state
 * @returns {Object} Dashboard statistics
 */
export function getDashboardStats(state) {
  return state.admin.dashboard.stats;
}

/**
 * Get recent activity
 *
 * @param {Object} state - Redux state
 * @returns {Array} Recent activity items
 */
export function getDashboardRecentActivity(state) {
  return state.admin.dashboard.recentActivity;
}

/**
 * Get dashboard loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if dashboard is loading
 */
export function getDashboardLoading(state) {
  return state.admin.dashboard.loading;
}

/**
 * Get dashboard error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export function getDashboardError(state) {
  return state.admin.dashboard.error;
}
