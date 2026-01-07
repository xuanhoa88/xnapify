/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as authController from '../controllers/auth.controller';

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
 * @param {Object} userMiddlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with authentication routes
 */
export default function authRoutes(deps, userMiddlewares, app) {
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
  router.post('/logout', requireAuth, authController.logout);

  /**
   * @route   GET /me
   * @desc    Get current authenticated user
   * @access  Private (requires authentication)
   */
  router.get('/me', requireAuth, authController.me);

  /**
   * @route   POST /refresh-token
   * @desc    Refresh authentication tokens using refresh token cookie
   * @access  Public (uses refresh token from cookie)
   */
  router.post('/refresh-token', authController.refreshToken);

  /**
   * @route   POST /reset-password/request
   * @desc    Request password reset email
   * @access  Public
   * @body    { email }
   */
  router.post('/reset-password/request', authController.resetPasswordRequest);

  /**
   * @route   POST /password-reset/confirmation
   * @desc    Reset password with token
   * @access  Public
   * @body    { token, password }
   */
  router.post(
    '/password-reset/confirmation',
    authController.resetPasswordConfirmation,
  );

  /**
   * @route   POST /email-verification
   * @desc    Verify email address with token
   * @access  Public
   * @body    { token }
   */
  router.post('/email-verification', authController.emailVerification);

  /**
   * @route   GET /generate-password
   * @desc    Generate a random secure password
   * @access  Public
   * @query   { length, includeSymbols }
   */
  router.get('/generate-password', authController.generateRandomPassword);

  return router;
}
