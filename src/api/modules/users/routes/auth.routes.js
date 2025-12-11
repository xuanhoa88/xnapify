/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { authController } from '../controllers';

/**
 * Authentication Routes
 *
 * Handles user authentication operations including registration, login, logout,
 * and current user retrieval.
 *
 * All routes are public except /me which requires authentication.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} middlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with authentication routes
 */
export default function authRoutes(deps, middlewares, app) {
  const auth = app.get('auth');

  // Create requireAuth middleware
  const requireAuth = auth.middlewares.requireAuth();

  const router = deps.Router();

  /**
   * @route   POST /register
   * @desc    Register a new user
   * @access  Public
   * @body    { email, password, display_name }
   */
  router.post('/register', authController.register);

  /**
   * @route   POST /login
   * @desc    Login user and set JWT cookie
   * @access  Public
   * @body    { email, password }
   */
  router.post('/login', authController.login);

  /**
   * @route   POST /logout
   * @desc    Logout user and clear JWT cookie
   * @access  Public
   */
  router.post('/logout', authController.logout);

  /**
   * @route   GET /me
   * @desc    Get current authenticated user
   * @access  Private (requires authentication)
   */
  router.get('/me', requireAuth, authController.me);

  /**
   * @route   POST /request-reset-password
   * @desc    Request password reset email
   * @access  Public
   * @body    { email }
   */
  router.post('/request-reset-password', authController.forgotPassword);

  /**
   * @route   POST /reset-password
   * @desc    Reset password with token
   * @access  Public
   * @body    { token, password }
   */
  router.post('/reset-password', authController.resetPassword);

  /**
   * @route   POST /verify-email
   * @desc    Verify email address with token
   * @access  Public
   * @body    { token }
   */
  router.post('/verify-email', authController.verifyEmail);

  return router;
}
