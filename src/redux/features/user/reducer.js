/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  LOGIN_SUCCESS,
  REGISTER_SUCCESS,
  LOGOUT,
  UPDATE_USER,
  FETCH_USER_SUCCESS,
  FETCH_USER_ERROR,
} from './constants';

// Initial state for user feature
// null = not authenticated
// object = authenticated user data from JWT token
const initialState = null;

/**
 * User reducer
 *
 * Manages user authentication state.
 * User state is set during SSR from req.user (JWT token).
 *
 * State shape when authenticated:
 * {
 *   id: string,
 *   email: string,
 *   display_name: string,
 *   role: string,  // 'admin', 'user', etc.
 *   is_admin: boolean,  // Optional flag
 *   // ... other user properties from JWT
 * }
 *
 * @param {Object|null} state - Current user state (null if not authenticated)
 * @param {Object} action - Redux action
 * @returns {Object|null} New user state
 */
export default function user(state = initialState, action) {
  switch (action.type) {
    case LOGIN_SUCCESS:
    case REGISTER_SUCCESS:
    case FETCH_USER_SUCCESS:
      // Set user data from successful authentication or fetch
      return action.payload;

    case FETCH_USER_ERROR:
      // If fetching user fails (e.g. 404 Not Found), clear state
      return null;

    case LOGOUT:
      // Clear user state
      return null;

    case UPDATE_USER:
      // Update user properties
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}
