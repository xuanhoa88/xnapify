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
 * @param {Object} app - Express application instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router with profile routes
 */
export default function profileRoutes(app, userMiddlewares, { Router }) {
  const router = Router();
  const auth = app.get('auth');
  const fs = app.get('fs');

  // Create requireAuth middleware
  const requireAuth = auth.requireAuthMiddleware();

  // Create upload middleware for avatar
  const avatarUpload = fs.useUploadMiddleware({
    fieldName: 'avatar',
    maxFiles: 1,
    maxFileSize: parseInt(process.env.RSK_AVATAR_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
  });

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
   * @route   GET /avatar
   * @desc    Preview uploaded avatar file
   * @access  Private (requires authentication)
   * @query   { fileName }
   */
  router.get('/avatar', requireAuth, profileController.previewAvatar);

  /**
   * @route   POST /avatar
   * @desc    Upload and link user avatar
   * @access  Private (requires authentication)
   * @body    multipart/form-data with 'avatar' field
   */
  router.post(
    '/avatar',
    requireAuth,
    avatarUpload,
    profileController.uploadAvatar,
  );

  /**
   * @route   DELETE /avatar
   * @desc    Remove user avatar
   * @access  Private (requires authentication)
   */
  router.delete('/avatar', requireAuth, profileController.removeAvatar);

  /**
   * @route   PUT /password
   * @desc    Change user password
   * @access  Private (requires authentication)
   * @body    { currentPassword, newPassword }
   */
  router.put('/password', requireAuth, profileController.changePassword);

  /**
   * @route   GET /preferences
   * @desc    Get user preferences
   * @access  Private (requires authentication)
   */
  router.get('/preferences', requireAuth, profileController.getPreferences);

  /**
   * @route   PUT /preferences
   * @desc    Update user preferences
   * @access  Private (requires authentication)
   * @body    { language, timezone, notifications, theme }
   */
  router.put('/preferences', requireAuth, profileController.updatePreferences);

  return router;
}
