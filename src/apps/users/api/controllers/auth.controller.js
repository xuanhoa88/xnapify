/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  setTokenCookie,
  setRefreshTokenCookie,
  clearAllAuthCookies,
  getRefreshTokenFromCookie,
} from '@shared/cookies';
import { validateForm } from '@shared/validator';

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

// ========================================================================
// AUTHENTICATION CONTROLLERS
// ========================================================================

/**
 * Register a new user
 *
 * @route   POST /api/auth/register
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function register(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');

  try {
    const { email, password, confirmPassword } = req.body;

    // Validate input
    const [isValid, validationErrors] = validateForm(registerFormSchema, {
      email,
      password,
      confirmPassword,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors);
    }

    // Get auth utilities from app context
    const auth = container.resolve('auth');

    // Register user - returns complete user data with RBAC
    const userData = await authService.registerUser(
      {
        email,
        password,
      },
      {
        auth,
        models: container.resolve('models'),
        hook: container.resolve('hook'),
        defaultRoleName: auth.DEFAULT_ROLE,
      },
    );

    // Generate token pair using configured JWT instance
    const jwt = container.resolve('jwt');
    const tokens = jwt.generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
      is_admin: userData.is_admin === true,
    });

    // Set token cookies
    setTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

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

    // Event-driven generic HTTP Error delegation mapping
    const statusCode = error.statusCode || error.status;
    if (statusCode && statusCode >= 400 && statusCode < 600) {
      return http.sendError(res, error.message, statusCode, error);
    }

    return http.sendServerError(res, 'Registration failed', error);
  }
}

/**
 * Login user
 *
 * @route   POST /api/auth/login
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function login(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate input
    const [isValid, validationErrors] = validateForm(loginFormSchema, {
      email,
      password,
    });
    if (!isValid) {
      return http.sendValidationError(res, validationErrors);
    }

    // Authenticate user - returns complete user data with RBAC in one query
    const auth = container.resolve('auth');
    const userData = await authService.authenticateUser(email, password, {
      activitiesData: {
        ip_address: http.getClientIP(req),
        user_agent: http.getUserAgent(req),
      },
      models: container.resolve('models'),
      hook: container.resolve('hook'),
      defaultRoleName: auth.DEFAULT_ROLE,
      adminRoleName: auth.ADMIN_ROLE,
      defaultResources: auth.DEFAULT_RESOURCES,
      defaultActions: auth.DEFAULT_ACTIONS,
    });

    // Generate token pair using configured JWT instance
    const tokens = container.resolve('jwt').generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
      is_admin: userData.is_admin === true,
    });

    // Set cookie options based on rememberMe
    // If rememberMe is false, don't set maxAge (session cookie - expires on browser close)
    // If rememberMe is true, use default maxAge from cookie config
    const cookieOptions = rememberMe ? {} : { maxAge: null };
    setTokenCookie(res, tokens.accessToken, cookieOptions);
    setRefreshTokenCookie(res, tokens.refreshToken, cookieOptions);

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
 * @route   GET /api/auth/logout
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function logout(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    // Log logout activities via service (if user is authenticated)
    if (req.user) {
      await authService.logoutUser(req.user.id, {
        hook: container.resolve('hook'),
      });
    }

    // Clear token cookies
    clearAllAuthCookies(res);

    // Also clear cache entry for this token (if present)
    if (req.token) {
      container.resolve('jwt').cache.delete(req.token);
    }

    return http.sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    return http.sendServerError(res, 'Logout failed', error);
  }
}

/**
 * Refresh authentication token
 *
 * @route   POST /api/auth/refresh
 * @access  Private (requires authentication)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function refreshToken(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    // Get refresh token from cookie
    const refreshToken = getRefreshTokenFromCookie(req);

    if (!refreshToken) {
      return http.sendUnauthorized(res, 'Refresh token required');
    }

    // Generate new token pair
    const newTokens = req.app
      .get('container')
      .resolve('jwt')
      .refreshTokenPair(refreshToken);

    // Set new token cookies
    setTokenCookie(res, newTokens.accessToken);
    setRefreshTokenCookie(res, newTokens.refreshToken);

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
 * @route   POST /api/auth/email-verification
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function emailVerification(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { token } = req.body;

    // Validate input using shared schema
    const [isValid, validationErrors] = validateForm(
      emailVerificationFormSchema,
      { token },
    );
    if (!isValid) {
      return http.sendValidationError(res, validationErrors);
    }

    // Get models from app context
    const models = container.resolve('models');

    // Verify email with token (activities logged in service)
    const user = await authService.verifyEmail(token, {
      models,
      hook: container.resolve('hook'),
    });

    // Get complete user data with RBAC information
    const userData = await profileService.getUserWithProfile(user.id, {
      models,
    });

    // Generate token pair using configured JWT instance
    const tokens = req.app
      .get('container')
      .resolve('jwt')
      .generateTokenPair({
        id: user.id,
        email: user.email,
        picture: userData.picture || null,
        is_admin: userData.is_admin === true,
      });

    // Set token cookies
    setTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

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
 * @route   POST /api/auth/reset-password/request
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPasswordRequest(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
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
      return http.sendValidationError(res, validationErrors);
    }

    // Request password reset (activities logged in service)
    await authService.resetPasswordRequest(email, {
      models: container.resolve('models'),
      hook: container.resolve('hook'),
    });

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
 * @route   POST /api/auth/password-reset/confirmation
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetPasswordConfirmation(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
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
      return http.sendValidationError(res, validationErrors);
    }

    // Confirm reset password with token (activities logged in service)
    await authService.resetPasswordConfirmation(token, password, {
      models: container.resolve('models'),
      auth: container.resolve('auth'),
      hook: container.resolve('hook'),
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
  const container = req.app.get('container');
  const http = container.resolve('http');
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

/**
 * Handle OAuth callback after user authenticates with provider
 *
 * @access  Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function oauthCallback(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const appUrl = process.env.XNAPIFY_PUBLIC_APP_URL;

  try {
    const { provider } = req.params;

    // req.user will contain the passport profile
    const profile = req.user;
    if (!profile) {
      return http.sendUnauthorized(res, 'OAuth authentication failed');
    }

    // Authenticate or register user using the profile
    const auth = container.resolve('auth');

    const userData = await authService.oauthLogin(provider, profile, {
      models: container.resolve('models'),
      hook: container.resolve('hook'),
      defaultRoleName: auth.DEFAULT_ROLE,
    });

    // Generate token pair
    const jwt = container.resolve('jwt');
    const tokens = jwt.generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
      is_admin: userData.is_admin === true,
    });

    // Set token cookies
    setTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    // Redirect to frontend.
    // Cookies are set, so the frontend will automatically be authenticated.
    return res.redirect(`${appUrl}/?oauth=success`);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return res.redirect(`${appUrl}/?oauth=error`);
  }
}

/**
 * Stop impersonating and return to original admin identity
 *
 * @route   POST /api/auth/stop-impersonating
 * @access  Private (impersonated users only)
 */
export async function stopImpersonating(req, res) {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const impersonatorId = req.user.impersonator_id;

    if (!impersonatorId) {
      return http.sendError(res, 'Not currently impersonating', 400);
    }

    const authConfig = container.resolve('auth');
    const models = container.resolve('models');
    const jwt = container.resolve('jwt');

    // Get original admin user data via service
    const userData = await authService.stopImpersonating(impersonatorId, {
      models,
      defaultRoleName: authConfig.DEFAULT_ROLE,
      adminRoleName: authConfig.ADMIN_ROLE,
      defaultResources: authConfig.DEFAULT_RESOURCES,
      defaultActions: authConfig.DEFAULT_ACTIONS,
    });

    // Generate NEW standard token pair (no impersonator_id)
    const tokens = jwt.generateTokenPair({
      id: userData.id,
      email: userData.email,
      picture: userData.picture || null,
      is_admin: userData.is_admin === true,
    });

    // Set new token cookies
    setTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    // Log activity for auditing
    await req.app
      .get('hook')('auth.activity')
      .emit('impersonation:stop', {
        admin_id: impersonatorId,
        target_id: req.user.id,
        ip_address: http.getClientIP(req),
      });

    return http.sendSuccess(res, {
      message: `Returned to original identity: ${(userData.profile && userData.profile.display_name) || userData.email}`,
      user: userData,
      accessToken: tokens.accessToken,
      impersonatorId: null,
    });
  } catch (error) {
    if (error.name === 'UserNotFoundError') {
      return http.sendNotFound(res, error.message);
    }
    return http.sendServerError(res, 'Failed to stop impersonation', error);
  }
}
