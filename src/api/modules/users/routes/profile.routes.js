/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { profileController } from '../controllers';

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
 * @param {Object} middlewares - Authentication middlewares
 * @param {Object} app - Express application instance
 * @returns {Router} Express router with profile routes
 */
export default function profileRoutes(deps, middlewares, app) {
  const auth = app.get('auth');
  const requireAuth = auth.middlewares.requireAuth({
    jwtSecret: app.get('jwtSecret'),
  });

  const router = deps.Router();

  /**
   * @route   GET /profile
   * @desc    Get user profile with extended information
   * @access  Private (requires authentication)
   */
  router.get('/profile', requireAuth, profileController.getProfile);

  /**
   * @route   PUT /profile
   * @desc    Update user profile information
   * @access  Private (requires authentication)
   * @body    { display_name, first_name, last_name, bio, location, website }
   */
  router.put('/profile', requireAuth, profileController.updateProfile);

  /**
   * @route   POST /profile/avatar
   * @desc    Upload user avatar image
   * @access  Private (requires authentication)
   * @body    FormData with 'avatar' file field
   */
  router.post('/profile/avatar', requireAuth, profileController.uploadAvatar);

  /**
   * @route   PUT /profile/password
   * @desc    Change user password
   * @access  Private (requires authentication)
   * @body    { currentPassword, newPassword }
   */
  router.put(
    '/profile/password',
    requireAuth,
    profileController.changePassword,
  );

  return router;
}
