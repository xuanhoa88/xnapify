/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as profileController from '../controllers/profile.controller';

/**
 * Profile Management Routes
 *
 * Handles user profile operations including profile viewing, updating,
 * avatar management, and password changes.
 *
 * All routes require authentication.
 *
 * @param {Object} deps - Dependencies injected by parent router
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} userMiddlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with profile routes
 */
export default function profileRoutes(deps, userMiddlewares, app) {
  const auth = app.get('auth');

  // Create requireAuth middleware
  const requireAuth = auth.middlewares.requireAuth();

  const router = deps.Router();

  /**
   * @route   GET /
   * @desc    Get user profile with extended information
   * @access  Private (requires authentication)
   */
  router.get('/', requireAuth, profileController.getProfile);

  /**
   * @route   PUT /
   * @desc    Update user profile information
   * @access  Private (requires authentication)
   * @body    { display_name, first_name, last_name, bio, location, website }
   */
  router.put('/', requireAuth, profileController.updateProfile);

  /**
   * @route   PUT /avatar
   * @desc    Link uploaded file as user avatar
   * @access  Private (requires authentication)
   * @body    { fileName }
   */
  router.put('/avatar', requireAuth, profileController.linkAvatar);

  /**
   * @route   PUT /password
   * @desc    Change user password
   * @access  Private (requires authentication)
   * @body    { currentPassword, newPassword }
   */
  router.put('/password', requireAuth, profileController.changePassword);

  return router;
}
