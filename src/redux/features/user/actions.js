/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  LOGIN_START,
  LOGIN_SUCCESS,
  LOGIN_ERROR,
  REGISTER_START,
  REGISTER_SUCCESS,
  REGISTER_ERROR,
  LOGOUT,
  UPDATE_USER,
  FETCH_USER_START,
  FETCH_USER_SUCCESS,
  FETCH_USER_ERROR,
  RESET_PASSWORD_START,
  RESET_PASSWORD_SUCCESS,
  RESET_PASSWORD_ERROR,
} from './constants';

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
    dispatch({ type: LOGIN_START });

    try {
      const { data } = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Update user state
      dispatch({
        type: LOGIN_SUCCESS,
        payload: data.user,
      });

      return { success: true, user: data.user };
    } catch (error) {
      dispatch({
        type: LOGIN_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: REGISTER_START });

    try {
      const { data } = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName, // Convert to snake_case for backend
        }),
      });

      // Update user state
      dispatch({
        type: REGISTER_SUCCESS,
        payload: data.user,
      });

      return { success: true, user: data.user };
    } catch (error) {
      dispatch({
        type: REGISTER_ERROR,
        payload: error.message,
      });

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
      // Call logout API to clear server-side session/cookie
      await fetch('/api/logout', {
        method: 'POST',
      });
    } catch (error) {
      // TODO: Handle logout error
      console.error('Logout error:', error);
    } finally {
      // Clear user state
      dispatch({
        type: LOGOUT,
      });
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
export function getCurrentUser() {
  return async (dispatch, getState, { fetch }) => {
    dispatch({ type: FETCH_USER_START });

    try {
      const { data } = await fetch('/api/me');

      // Update user state
      dispatch({
        type: FETCH_USER_SUCCESS,
        payload: data.user,
      });

      return { success: true, user: data.user };
    } catch (error) {
      dispatch({
        type: FETCH_USER_ERROR,
        payload: error.message,
      });

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
    dispatch({ type: RESET_PASSWORD_START });

    try {
      const { data } = await fetch('/api/users/request-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      dispatch({
        type: RESET_PASSWORD_SUCCESS,
      });

      return { success: true, message: data.message };
    } catch (error) {
      dispatch({
        type: RESET_PASSWORD_ERROR,
        payload: error.message,
      });

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
export function updateUser(userData) {
  return async (dispatch, getState, { fetch }) => {
    try {
      const { data } = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      dispatch({
        type: UPDATE_USER,
        payload: data.profile,
      });

      return { success: true, user: data.profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}
