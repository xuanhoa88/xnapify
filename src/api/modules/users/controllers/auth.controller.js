/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as authService from '../services/auth.service';
import { validateRegistration, validateLogin } from '../utils/validation';

// ========================================================================
// AUTHENTICATION CONTROLLERS
// ========================================================================

/**
 * Register a new user
 *
 * @route   POST /api/register
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

    // Get complete user data with RBAC information
    const userData = await authService.getCurrentUser(user.id, models);

    // Generate token pair using configured JWT instance
    const jwt = req.app.get('jwt');
    const tokens = jwt.generateTokenPair({ id: user.id, email: user.email });

    // Set token cookies
    auth.setTokenCookie(res, tokens.accessToken);
    auth.setRefreshTokenCookie(res, tokens.refreshToken);

    // Return user data with RBAC information
    return http.sendSuccess(res, { user: userData }, 201);
  } catch (error) {
    if (error.name === 'UserAlreadyExistsError') {
      return http.sendError(res, 'User with this email already exists', 409);
    }

    return http.sendServerError(res, 'Registration failed');
  }
}

/**
 * Login user
 *
 * @route   POST /api/login
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function login(req, res) {
  const http = req.app.get('http');
  try {
    const { email, password, rememberMe = false } = req.body;

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

    // Get complete user data with RBAC information
    const userData = await authService.getCurrentUser(user.id, models);

    // Generate token pair using configured JWT instance
    const jwt = req.app.get('jwt');
    const tokens = jwt.generateTokenPair({ id: user.id, email: user.email });

    // Set cookie options based on rememberMe
    // If rememberMe is false, don't set maxAge (session cookie - expires on browser close)
    // If rememberMe is true, use default maxAge from cookie config
    const cookieOptions = rememberMe ? {} : { maxAge: null };

    auth.setTokenCookie(res, tokens.accessToken, cookieOptions);
    auth.setRefreshTokenCookie(res, tokens.refreshToken, cookieOptions);

    // Return user data with RBAC information and access token for WS auth
    return http.sendSuccess(res, {
      user: userData,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendUnauthorized(res, 'User not found');
    }

    if (error.name === 'UserInactiveError') {
      return http.sendUnauthorized(res, 'User is inactive');
    }

    if (error.name === 'UserLockedError') {
      return http.sendUnauthorized(res, 'User is locked');
    }

    if (error.name === 'InvalidCredentialsError') {
      return http.sendUnauthorized(res, 'Invalid email or password');
    }

    return http.sendServerError(res, 'Login failed');
  }
}

/**
 * Logout user
 *
 * @route   POST /api/logout
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function logout(req, res) {
  const http = req.app.get('http');
  try {
    const auth = req.app.get('auth');

    // Clear token cookies
    auth.clearAllAuthCookies(res);

    return http.sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Logout failed');
  }
}

/**
 * Get current authenticated user
 *
 * @route   GET /api/me
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function me(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Get complete user data with RBAC information
    const userData = await authService.getCurrentUser(req.user.id, models);

    return http.sendSuccess(res, { user: userData });
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
    // Get refresh token from cookie
    const auth = req.app.get('auth');
    const refreshToken = auth.getTokenFromCookie(req);

    if (!refreshToken) {
      return http.sendUnauthorized(res, 'Refresh token required');
    }

    // Generate new token pair
    const jwt = req.app.get('jwt');
    const newTokens = jwt.refreshTokenPair(refreshToken);

    // Set new token cookies
    auth.setTokenCookie(res, newTokens.accessToken);
    auth.setRefreshTokenCookie(res, newTokens.refreshToken);

    return http.sendSuccess(res, { message: 'Token refreshed successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to refresh token');
  }
}

/**
 * Verify email address
 *
 * @route   POST /api/users/email-verification
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function emailVerification(req, res) {
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
      error.name === 'InvalidTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return http.sendError(res, 'Invalid or expired verification token', 400);
    }

    if (error.name === 'UserNotFoundError') {
      return http.sendError(res, 'User not found', 404);
    }

    if (error.name === 'EmailAlreadyVerifiedError') {
      return http.sendError(res, 'Email already verified', 400);
    }

    return http.sendServerError(res, 'Email verification failed');
  }
}

/**
 * Request password reset
 *
 * @route   POST /api/users/request-reset-password
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
    await authService.requestResetPassword(email, models);

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
 * Confirm reset password with token
 *
 * @route   POST /api/users/reset-password-confirmation
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPasswordConfirmation(req, res) {
  const http = req.app.get('http');
  try {
    const { token, password, confirmPassword } = req.body;

    // Validate input
    const errors = {};
    if (!token) errors.token = 'RESET_TOKEN_REQUIRED';
    if (!password) errors.password = 'NEW_PASSWORD_REQUIRED';
    if (!confirmPassword) errors.confirmPassword = 'CONFIRM_PASSWORD_REQUIRED';
    if (password && password !== confirmPassword)
      errors.confirmPassword = 'PASSWORDS_DO_NOT_MATCH';

    if (Object.keys(errors).length > 0) {
      return http.sendValidationError(res, errors);
    }

    // Get models and auth utilities from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');

    // Confirm reset password with token
    await authService.resetPasswordConfirmation(token, password, {
      models,
      auth,
    });

    return http.sendSuccess(res, {
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (
      error.name === 'InvalidTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return http.sendError(res, 'Invalid or expired reset token', 400);
    }

    if (error.name === 'UserNotFoundError') {
      return http.sendError(res, 'User not found', 404);
    }

    if (error.name === 'EmailAlreadyVerifiedError') {
      return http.sendError(res, 'Email already verified', 400);
    }

    return http.sendServerError(res, 'Password reset failed');
  }
}
