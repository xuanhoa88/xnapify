/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  loginStart,
  loginSuccess,
  loginError,
  registerStart,
  registerSuccess,
  registerError,
  logout as logoutAction,
  fetchUserStart,
  fetchUserSuccess,
  fetchUserError,
  resetPasswordStart,
  resetPasswordSuccess,
  resetPasswordError,
  updateUser,
} from './slice';

/**
 * User Thunks
 *
 * Async thunk actions for user authentication and profile management.
 * These maintain the existing return pattern { success, data/error } for backward compatibility.
 */

/**
 * Login user
 *
 * Authenticates user with email and password
 *
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @returns {Function} Redux thunk action
 */
export function login({ email, password }) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(loginStart());

    try {
      const { data } = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      dispatch(loginSuccess(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      dispatch(loginError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Register new user
 *
 * Creates a new user account
 *
 * @param {Object} userData - Registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.displayName - User display name (optional)
 * @returns {Function} Redux thunk action
 */
export function register({ email, password, displayName }) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(registerStart());

    try {
      const { data } = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
        }),
      });

      dispatch(registerSuccess(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      dispatch(registerError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Logout user
 *
 * Clears user state and calls logout API endpoint
 *
 * @returns {Function} Redux thunk action
 */
export function logout() {
  return async (dispatch, getState, { fetch }) => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  };
}

/**
 * Get current user
 *
 * Fetches current authenticated user from server
 *
 * @returns {Function} Redux thunk action
 */
export function me() {
  return async (dispatch, getState, { fetch }) => {
    dispatch(fetchUserStart());

    try {
      const { data } = await fetch('/api/me');

      dispatch(fetchUserSuccess(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      dispatch(fetchUserError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Reset password
 *
 * Sends password reset email to user
 *
 * @param {Object} data - Reset password data
 * @param {string} data.email - User email
 * @returns {Function} Redux thunk action
 */
export function resetPassword({ email }) {
  return async (dispatch, getState, { fetch }) => {
    dispatch(resetPasswordStart());

    try {
      const { data } = await fetch('/api/users/request-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      dispatch(resetPasswordSuccess());

      return { success: true, message: data.message };
    } catch (error) {
      dispatch(resetPasswordError(error.message));

      return { success: false, error: error.message };
    }
  };
}

/**
 * Updates user profile information on the server
 *
 * @param {Object} userData - User data to update
 * @returns {Function} Redux thunk action
 */
export function updateCurrentUser(userData) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      dispatch(updateUser(data.profile));

      return { success: true, user: data.profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}
