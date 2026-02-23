/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../../shared/validator';
import {
  loginFormSchema,
  registerFormSchema,
  emailVerificationFormSchema,
  passwordResetRequestFormSchema,
  passwordResetConfirmFormSchema,
} from '../../validator/auth';
import * as authService from '../services/auth.service';
import * as profileService from '../services/profile.service';
import { generatePassword } from '../utils/password';
import { formatUserResponse } from '../utils/formatters';

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
    const { email, password, confirmPassword } = req.body;

    // Validate input
    const [isValid, validationErrors] = validateForm(registerFormSchema, {
      email,
      password,
      confirmPassword,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    // Get models and auth utilities from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');

    // Get webhook engine for activity tracking
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Register user - returns complete user data with RBAC
    const userData = await authService.registerUser(
      {
        email,
        password,
      },
      { models, auth, webhook, hook },
    );

    // Generate token pair using configured JWT instance
    const jwt = req.app.get('jwt');
    const tokens = jwt.generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
    });

    // Set token cookies
    auth.setTokenCookie(res, tokens.accessToken);
    auth.setRefreshTokenCookie(res, tokens.refreshToken);

    // Return user data with RBAC information and access token for WS auth
    return http.sendSuccess(
      res,
      {
        user: userData,
        accessToken: tokens.accessToken,
      },
      201,
    );
  } catch (error) {
    if (error.name === 'UserAlreadyExistsError') {
      return http.sendError(res, 'User with this email already exists', 409);
    }

    return http.sendServerError(res, 'Registration failed', error);
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
    const [isValid, validationErrors] = validateForm(loginFormSchema, {
      email,
      password,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    // Get models from app context
    const models = req.app.get('models');

    // Get webhook engine for activity tracking
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Authenticate user - returns complete user data with RBAC in one query
    const userData = await authService.authenticateUser(email, password, {
      activityData: {
        ip_address: http.getClientIP(req),
        user_agent: http.getUserAgent(req),
      },
      models,
      webhook,
      hook,
    });

    // Generate token pair using configured JWT instance
    const jwt = req.app.get('jwt');
    const tokens = jwt.generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
    });

    // Set cookie options based on rememberMe
    // If rememberMe is false, don't set maxAge (session cookie - expires on browser close)
    // If rememberMe is true, use default maxAge from cookie config
    const cookieOptions = rememberMe ? {} : { maxAge: null };
    const auth = req.app.get('auth');
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

    return http.sendServerError(res, 'Login failed', error);
  }
}

/**
 * Logout user
 *
 * @route   GET /api/logout
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function logout(req, res) {
  const http = req.app.get('http');
  try {
    const auth = req.app.get('auth');
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Log logout activity via service (if user is authenticated)
    if (req.user) {
      await authService.logoutUser(req.user.id, { webhook, hook });
    }

    // Clear token cookies
    auth.clearAllAuthCookies(res);

    return http.sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Logout failed', error);
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
    const refreshToken = auth.getRefreshTokenFromCookie(req);

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
    // Handle specific token errors
    if (error.name === 'TokenExpiredError') {
      return http.sendUnauthorized(res, 'Refresh token has expired');
    }

    if (error.name === 'InvalidTokenFormatError') {
      return http.sendUnauthorized(res, 'Invalid refresh token format');
    }

    if (error.name === 'InvalidTokenTypeError') {
      return http.sendUnauthorized(res, 'Invalid token type');
    }

    if (error.name === 'InvalidTokenStringError') {
      return http.sendUnauthorized(res, 'Invalid refresh token');
    }

    return http.sendServerError(res, 'Failed to refresh token', error);
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

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(
      emailVerificationFormSchema,
      { token },
    );
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Verify email with token (activity logged in service)
    const user = await authService.verifyEmail(token, {
      models,
      webhook,
      hook,
    });

    // Get complete user data with RBAC information
    const userData = await profileService.getUserWithProfile(user.id, {
      models,
    });

    // Generate token pair using configured JWT instance
    const jwt = req.app.get('jwt');
    const auth = req.app.get('auth');
    const tokens = jwt.generateTokenPair({
      id: user.id,
      email: user.email,
      picture: userData.picture || null,
    });

    // Set token cookies
    auth.setTokenCookie(res, tokens.accessToken);
    auth.setRefreshTokenCookie(res, tokens.refreshToken);

    return http.sendSuccess(res, {
      message: 'Email verified successfully',
      user: userData,
      accessToken: tokens.accessToken,
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

    return http.sendServerError(res, 'Email verification failed', error);
  }
}

/**
 * Request password reset
 *
 * @route   POST /api/users/reset-password/request
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPasswordRequest(req, res) {
  const http = req.app.get('http');
  try {
    const { email } = req.body;

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(
      passwordResetRequestFormSchema,
      {
        email,
      },
    );
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    // Get models and webhook from app context
    const models = req.app.get('models');
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Request password reset (activity logged in service)
    await authService.resetPasswordRequest(email, { models, webhook, hook });

    // Always return success for security (don't reveal if email exists)
    return http.sendSuccess(res, {
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to process password reset request',
      error,
    );
  }
}

/**
 * Confirm reset password with token
 *
 * @route   POST /api/users/password-reset/confirmation
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPasswordConfirmation(req, res) {
  const http = req.app.get('http');
  try {
    const { token, password, confirmPassword } = req.body;

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(
      passwordResetConfirmFormSchema,
      {
        token,
        password,
        confirmPassword,
      },
    );
    if (!isValid) {
      return http.sendValidationError(res, validationErrors[0]);
    }

    // Get models, auth, and webhook from app context
    const models = req.app.get('models');
    const auth = req.app.get('auth');
    const webhook = req.app.get('webhook');
    const hook = req.app.get('hook').withContext(req.app);

    // Confirm reset password with token (activity logged in service)
    await authService.resetPasswordConfirmation(token, password, {
      models,
      auth,
      webhook,
      hook,
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

    return http.sendServerError(res, 'Password reset failed', error);
  }
}

/**
 * Generate a random secure password
 *
 * @route   GET /api/auth/generate-password
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function generateRandomPassword(req, res) {
  const http = req.app.get('http');
  try {
    const { length = 16, includeSymbols = true } = req.query;

    const password = generatePassword({
      length: parseInt(length, 10) || 16,
      includeSymbols: includeSymbols !== 'false',
      excludeAmbiguous: true,
    });

    return http.sendSuccess(res, { password });
  } catch (error) {
    return http.sendServerError(res, 'Failed to generate password', error);
  }
}
