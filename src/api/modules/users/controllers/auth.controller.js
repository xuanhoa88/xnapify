/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { authService, profileService } from '../services';
import { validateRegistration, validateLogin } from '../utils/validation';

// ========================================================================
// AUTHENTICATION CONTROLLERS
// ========================================================================

/**
 * Register a new user
 *
 * @route   POST /api/users/register
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function register(req, res) {
  const http = req.app.get('http');

  try {
    const { email, password, display_name } = req.body;

    // Validate input
    const validationErrors = validateRegistration({
      email,
      password,
      display_name,
    });
    if (Object.keys(validationErrors).length > 0) {
      return http.sendValidationError(res, validationErrors);
    }

    // Get models and auth utilities from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');

    // Register user
    const user = await authService.registerUser(
      {
        email,
        password,
        display_name,
      },
      { models, auth },
    );

    // Generate JWT token using consolidated JWT utilities
    const token = auth.jwt.generateTypedToken(
      'access',
      { id: user.id, email: user.email },
      req.app.get('jwtSecret'),
      { expiresIn: req.app.get('jwtExpiresIn') },
    );

    // Set token cookie
    auth.setTokenCookie(res, token);

    // Return user data
    return http.sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          email_confirmed: user.email_confirmed,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
          display_name: (user.profile && user.profile.display_name) || null,
          first_name: (user.profile && user.profile.first_name) || null,
          last_name: (user.profile && user.profile.last_name) || null,
          picture: (user.profile && user.profile.picture) || null,
          bio: (user.profile && user.profile.bio) || null,
          location: (user.profile && user.profile.location) || null,
          website: (user.profile && user.profile.website) || null,
          role: user.role || 'user',
        },
      },
      201,
    );
  } catch (error) {
    if (error.message === 'USER_ALREADY_EXISTS') {
      return http.sendError(res, 'User with this email already exists', 409);
    }

    return http.sendServerError(res, 'Registration failed');
  }
}

/**
 * Login user
 *
 * @route   POST /api/users/login
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function login(req, res) {
  const http = req.app.get('http');
  try {
    const { email, password } = req.body;

    // Validate input
    const validationErrors = validateLogin({ email, password });
    if (Object.keys(validationErrors).length > 0) {
      return http.sendValidationError(res, validationErrors);
    }

    // Get models and auth utilities from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');

    // Authenticate user
    const user = await authService.authenticateUser(email, password, {
      models,
      auth,
    });

    // Generate JWT token using consolidated JWT utilities
    const token = auth.jwt.generateTypedToken(
      'access',
      { id: user.id, email: user.email },
      req.app.get('jwtSecret'),
      { expiresIn: req.app.get('jwtExpiresIn') },
    );

    // Set token cookie
    auth.setTokenCookie(res, token);

    // Return user data
    return http.sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        display_name: (user.profile && user.profile.display_name) || null,
        first_name: (user.profile && user.profile.first_name) || null,
        last_name: (user.profile && user.profile.last_name) || null,
        picture: (user.profile && user.profile.picture) || null,
        bio: (user.profile && user.profile.bio) || null,
        location: (user.profile && user.profile.location) || null,
        website: (user.profile && user.profile.website) || null,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.log(error);
    if (error.message === 'INVALID_CREDENTIALS') {
      return http.sendUnauthorized(res, 'Invalid email or password');
    }

    if (error.message === 'ACCOUNT_INACTIVE') {
      return http.sendUnauthorized(res, 'Account is inactive');
    }

    return http.sendServerError(res, 'Login failed');
  }
}

/**
 * Logout user
 *
 * @route   POST /api/users/logout
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function logout(req, res) {
  const http = req.app.get('http');
  try {
    const auth = req.app.get('auth');

    // Clear token cookie
    auth.clearTokenCookie(res);

    return http.sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Logout failed');
  }
}

/**
 * Get current authenticated user
 *
 * @route   GET /api/users/me
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getCurrentUser(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Get user with profile
    const user = await profileService.getUserWithProfile(req.user.id, models);

    if (!user) {
      return http.sendNotFound(res, 'User not found');
    }

    return http.sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        display_name: (user.profile && user.profile.display_name) || null,
        first_name: (user.profile && user.profile.first_name) || null,
        last_name: (user.profile && user.profile.last_name) || null,
        picture: (user.profile && user.profile.picture) || null,
        bio: (user.profile && user.profile.bio) || null,
        location: (user.profile && user.profile.location) || null,
        website: (user.profile && user.profile.website) || null,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get user information');
  }
}

/**
 * Refresh authentication token
 *
 * @route   POST /api/users/refresh
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function refreshToken(req, res) {
  const http = req.app.get('http');
  try {
    // Generate new JWT token using global auth engine
    const auth = req.app.get('auth');
    const token = auth.jwt.generateTypedToken(
      'access',
      {
        id: req.user.id,
        email: req.user.email,
      },
      req.app.get('jwtSecret'),
      { expiresIn: req.app.get('jwtExpiresIn') },
    );

    // Set new token cookie
    auth.setTokenCookie(res, token);

    return http.sendSuccess(res, { message: 'Token refreshed successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to refresh token');
  }
}

/**
 * Verify email address
 *
 * @route   POST /api/users/verify-email
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function verifyEmail(req, res) {
  const http = req.app.get('http');
  try {
    const { token } = req.body;

    if (!token) {
      return http.sendValidationError(res, {
        token: 'Verification token is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Verify email with token
    const user = await authService.verifyEmail(token, models);

    return http.sendSuccess(res, {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
      },
    });
  } catch (error) {
    if (
      error.message === 'INVALID_TOKEN' ||
      error.message === 'TOKEN_EXPIRED'
    ) {
      return http.sendError(res, 'Invalid or expired verification token', 400);
    }

    if (error.message === 'USER_NOT_FOUND') {
      return http.sendError(res, 'User not found', 404);
    }

    if (error.message === 'EMAIL_ALREADY_VERIFIED') {
      return http.sendError(res, 'Email already verified', 400);
    }

    return http.sendServerError(res, 'Email verification failed');
  }
}

/**
 * Request password reset
 *
 * @route   POST /api/users/forgot-password
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function forgotPassword(req, res) {
  const http = req.app.get('http');
  try {
    const { email } = req.body;

    if (!email) {
      return http.sendValidationError(res, {
        email: 'Email is required',
      });
    }

    // Get models from app context
    const models = req.app.get('models');

    // Request password reset
    await authService.requestPasswordReset(email, models);

    // Always return success for security (don't reveal if email exists)
    return http.sendSuccess(res, {
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to process password reset request',
    );
  }
}

/**
 * Reset password with token
 *
 * @route   POST /api/users/reset-password
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPassword(req, res) {
  const http = req.app.get('http');
  try {
    const { token, password } = req.body;

    // Validate input
    const errors = {};
    if (!token) errors.token = 'Reset token is required';
    if (!password) errors.password = 'New password is required';

    if (Object.keys(errors).length > 0) {
      return http.sendValidationError(res, errors);
    }

    // Get models and auth utilities from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');

    // Reset password with token
    await authService.resetPassword(token, password, { models, auth });

    return http.sendSuccess(res, {
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (
      error.message === 'INVALID_TOKEN' ||
      error.message === 'TOKEN_EXPIRED'
    ) {
      return http.sendError(res, 'Invalid or expired reset token', 400);
    }

    if (error.message === 'USER_NOT_FOUND') {
      return http.sendError(res, 'User not found', 404);
    }

    if (error.message === 'EMAIL_ALREADY_VERIFIED') {
      return http.sendError(res, 'Email already verified', 400);
    }

    return http.sendServerError(res, 'Password reset failed');
  }
}
