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
export const getDashboardStats = state => state.admin.dashboard.stats;

/**
 * Get recent activity
 *
 * @param {Object} state - Redux state
 * @returns {Array} Recent activity items
 */
export const getDashboardRecentActivity = state =>
  state.admin.dashboard.recentActivity;

/**
 * Get dashboard loading state
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if dashboard is loading
 */
export const getDashboardLoading = state => state.admin.dashboard.loading;

/**
 * Get dashboard error
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Error message or null
 */
export const getDashboardError = state => state.admin.dashboard.error;
