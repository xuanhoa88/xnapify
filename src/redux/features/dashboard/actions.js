/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_DASHBOARD_START,
  FETCH_DASHBOARD_SUCCESS,
  FETCH_DASHBOARD_ERROR,
} from './constants';

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
    dispatch({ type: FETCH_DASHBOARD_START });

    try {
      const { data } = await fetch('/api/admin/dashboard/users');

      dispatch({
        type: FETCH_DASHBOARD_SUCCESS,
        payload: data,
      });

      return { success: true, data };
    } catch (error) {
      dispatch({
        type: FETCH_DASHBOARD_ERROR,
        payload: error.message,
      });

      return { success: false, error: error.message };
    }
  };
}
