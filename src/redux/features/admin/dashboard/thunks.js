/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  fetchDashboardStart,
  fetchDashboardSuccess,
  fetchDashboardError,
} from './slice';

/**
 * Dashboard Thunks
 */

/**
 * Fetch dashboard statistics and recent activity
 *
 * Retrieves system-wide statistics including user counts, role counts,
 * system status, and recent user activity.
 *
 * @returns {Function} Redux thunk action
 */
export function fetchDashboard() {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchDashboardStart());

    try {
      const { data } = await fetch('/api/admin/users/dashboard');

      dispatch(fetchDashboardSuccess(data));

      return { success: true, data };
    } catch (error) {
      dispatch(fetchDashboardError(error.message));

      return { success: false, error: error.message };
    }
  };
}
