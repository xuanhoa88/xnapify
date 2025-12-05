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

const initialState = {
  stats: {
    totalUsers: 0,
    activeRoles: 0,
    systemStatus: 'Unknown',
    uptime: '0%',
  },
  recentActivity: [],
  loading: false,
  error: null,
};

/**
 * Dashboard reducer
 *
 * Manages dashboard state including statistics and recent activity.
 *
 * @param {Object} state - Current state
 * @param {Object} action - Redux action
 * @returns {Object} New state
 */
export default function dashboardReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_DASHBOARD_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_DASHBOARD_SUCCESS:
      return {
        ...state,
        loading: false,
        stats: action.payload.stats || initialState.stats,
        recentActivity: action.payload.recentActivity || [],
        error: null,
      };

    case FETCH_DASHBOARD_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
