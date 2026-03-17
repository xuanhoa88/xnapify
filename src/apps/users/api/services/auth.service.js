/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { formatUserResponse } from '../utils/formatter';
import { userFullIncludes } from '../utils/includes';
import {
  hashToken,
  verifyPassword,
  createTimedResetToken,
  validateResetToken,
} from '../utils/password';

// ========================================================================
// AUTHENTICATION SERVICES
// ========================================================================

/**
 * Register a new user
 *
 * Returns complete user data with RBAC information.
 *
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.display_name - User display name (optional)
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models

 * @returns {Promise<Object>} Formatted user object with RBAC data
 * @throws {Error} If user already exists or creation fails
 */
export async function registerUser(
  userData,
  {
    models,
    hook,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = {},
) {
  const { email, password } = userData;
  const { User, UserProfile, Role } = models;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const error = new Error('User already exists');
    error.name = 'UserAlreadyExistsError';
    error.status = 400;
    throw error;
  }

  // Create user with profile (password hashed automatically by model hook)
  const user = await User.create(
    {
      email,
      email_confirmed: false,
      password,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      profile: [
        {
          attribute_key: 'display_name',
          attribute_value: userData.display_name || email.split('@')[0],
        },
      ],
    },
    {
      include: [
        {
          model: UserProfile,
          as: 'profile',
          required: false,
        },
      ],
    },
  );

  // Assign default role
  const defaultRole = await Role.findOne({
    where: { name: defaultRoleName },
  });
  if (defaultRole) {
    await user.addRole(defaultRole);
  }

  // Emit hook event if hook factory provided
  await hook('auth').emit('registered', { user_id: user.id, email, user });

  // Return formatted user data with default RBAC for new user
  return formatUserResponse(user, {
    rbacData: {
      roles: [defaultRoleName],
      permissions: [],
      groups: [],
    },
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  });
}

/**
 * Log user logout activities
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} [options.hook] - Hook factory for event emission
 * @returns {Promise<void>}
 */
export async function logoutUser(user_id, { hook } = {}) {
  // Emit hook event if hook factory provided
  await hook('auth').emit('logout', { user_id });
}

/**
 * Authenticate user with email and password
 *
 * Returns complete user data with RBAC information in a single query.
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.activitiesData - Activity data (optional)
 * @param {Object} options.hook - Hook factory for event emission
 * @param {string} options.defaultRoleName - Name of the default role for new users
 * @param {string} options.adminRoleName - Name of the admin role
 * @param {Array<string>} options.defaultResources - Default resources for RBAC
 * @param {Array<string>} options.defaultActions - Default actions for RBAC
 * @returns {Promise<Object>} Formatted user object with RBAC data
 * @throws {Error} If credentials are invalid
 */
export async function authenticateUser(
  email,
  password,
  {
    models,
    activitiesData,
    hook,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = {},
) {
  const { User } = models;

  // Find user with password and full RBAC data in ONE query
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: userFullIncludes(models, {
      includePermissions: true,
      roleAttributes: ['name'],
      groupAttributes: ['name'],
    }),
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if account is active
  if (!user.is_active) {
    const error = new Error('User inactive');
    error.name = 'UserInactiveError';
    error.status = 403;
    throw error;
  }

  // Check if account is locked
  if (user.is_locked) {
    const error = new Error('User locked');
    error.name = 'UserLockedError';
    error.status = 403;
    throw error;
  }

  // Verify password using global auth utilities
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    // Increment failed login attempts
    await user.increment('failed_login_attempts');

    // Lock account after 5 failed attempts
    if (user.failed_login_attempts >= 4) {
      await user.update({ is_locked: true });
    }

    const error = new Error('Invalid credentials');
    error.name = 'InvalidCredentialsError';
    error.status = 401;
    throw error;
  }

  // Reset failed login attempts on successful login
  if (user.failed_login_attempts > 0) {
    await user.update({ failed_login_attempts: 0 });
  }

  // Update user's last login
  await User.update({ last_login_at: new Date() }, { where: { id: user.id } });

  // Format user response
  const normalizedUser = await formatUserResponse(user, {
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  });

  // Emit hook event if hook factory provided
  await hook('auth').emit('logged_in', {
    user_id: user.id,
    activitiesData,
    user: normalizedUser,
  });

  return normalizedUser;
}

/**
 * Verify email address with token
 *
 * @param {string} token - Email verification token
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.hook - Hook factory for event emission
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid or expired
 */
export async function verifyEmail(token, { models, hook } = {}) {
  const { User } = models;

  // In a real implementation, you would decode and verify the JWT token
  // For now, we'll simulate token verification
  try {
    // Decode token to get user ID (simplified)
    const user_id = token; // In reality, decode JWT token

    const user = await User.findByPk(user_id);
    if (!user) {
      const error = new Error('User not found');
      error.name = 'UserNotFoundError';
      error.status = 404;
      throw error;
    }

    if (user.email_confirmed) {
      const error = new Error('Email already verified');
      error.name = 'EmailAlreadyVerifiedError';
      error.status = 400;
      throw error;
    }

    // Update email confirmation status
    await user.update({ email_confirmed: true });

    // Emit hook event if hook factory provided
    await hook('auth').emit('email_verified', {
      user_id: user.id,
      email: user.email,
    });

    return user;
  } catch (error) {
    error.name = 'InvalidTokenError';
    error.status = 400;
    throw error;
  }
}

/**
 * Request password reset
 *
 * Generates a secure reset token, stores the hash in the database,
 * and returns the raw token for sending via email.
 *
 * @param {string} email - User email
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models

 * @returns {Promise<Object>} Reset token info (token for email, message)
 */
export async function resetPasswordRequest(email, { models, hook } = {}) {
  const { User, PasswordResetToken } = models;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Don't reveal if email exists for security
    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Invalidate any existing unused tokens for this user
  await PasswordResetToken.update(
    { used_at: new Date() },
    {
      where: {
        user_id: user.id,
        used_at: null,
      },
    },
  );

  // Generate secure reset token (1 hour expiration)
  const tokenData = createTimedResetToken(user.id, { expiresIn: 3600 });

  // Store hashed token in database
  await PasswordResetToken.create({
    user_id: user.id,
    hashed_token: tokenData.hashedToken,
    expires_at: tokenData.expiresAt,
    used_at: null,
  });

  const resetLink = `${process.env['RSK_APP_URL']}/reset-password?token=${tokenData.token}`;

  // Emit hook event if hook factory provided
  await hook('auth').emit('password_reset_requested', {
    user_id: user.id,
    email,
    resetLink,
  });

  // Return the raw token (to be sent via email)
  // In production, you would send this via email instead of returning it
  return {
    resetToken: tokenData.token,
    message: 'Password reset link sent to email',
    // For development/testing only - remove in production
    expiresAt: tokenData.expiresAt,
  };
}

/**
 * Reset password confirmation
 *
 * Validates the token using timing-safe comparison, checks expiration
 * and single-use constraints, then updates the user's password.
 *
 * @param {string} token - Password reset token (raw token from email)
 * @param {string} newPassword - New password
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models

 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid, expired, or already used
 */
export async function resetPasswordConfirmation(
  token,
  newPassword,
  { models, hook } = {},
) {
  const { User, PasswordResetToken } = models;

  // Hash the submitted token and look it up in the database
  const submittedHash = hashToken(token);

  // Find the token record by hash
  const tokenRecord = await PasswordResetToken.findOne({
    where: { hashed_token: submittedHash },
  });
  if (!tokenRecord) {
    const error = new Error('Invalid token');
    error.name = 'InvalidTokenError';
    error.status = 400;
    throw error;
  }

  // Validate the token using our secure validation function
  const validation = validateResetToken(token, {
    hashedToken: tokenRecord.hashed_token,
    expiresAt: tokenRecord.expires_at,
    usedAt: tokenRecord.used_at,
  });

  if (!validation.valid) {
    const error = new Error(validation.errors.join(', '));
    error.name = 'InvalidTokenError';
    error.status = 400;
    throw error;
  }

  // Get the user
  const user = await User.findByPk(tokenRecord.user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Update password (hashed automatically by model hook)
  await user.update({
    password: newPassword,
    password_changed_at: new Date(),
    failed_login_attempts: 0,
    is_locked: false,
  });

  // Mark token as used (single-use enforcement)
  await tokenRecord.update({ used_at: new Date() });

  // Emit hook event if hook factory provided
  await hook('auth').emit('password_reset_completed', { user_id: user.id });

  return user;
}

/**
 * Authenticate or register a user via OAuth
 *
 * @param {string} provider - OAuth provider name (e.g., 'google')
 * @param {Object} profile - Passport profile object
 * @param {Object} options - Options object
 * @returns {Promise<Object>} Formatted user object with RBAC data
 */
export async function oauthLogin(
  provider,
  profile,
  {
    models,
    hook,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = {},
) {
  const { User, UserLogin, UserProfile, Role } = models;

  // Find UserLogin by provider and profile.id
  const userLogin = await UserLogin.findOne({
    where: { name: provider, key: profile.id },
  });

  let user;

  if (userLogin) {
    // Re-fetch user to get RBAC
    user = await User.findByPk(userLogin.user_id);
    if (!user) {
      throw new Error('User associated with OAuth login not found');
    }
  } else {
    // Registration or linking existing email
    const email =
      profile.emails && profile.emails.length > 0
        ? profile.emails[0].value
        : null;

    if (!email) {
      const error = new Error('OAuth profile did not provide an email address');
      error.status = 400;
      throw error;
    }

    user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user
      const displayName =
        profile.displayName ||
        (profile.name && profile.name.givenName) ||
        email.split('@')[0];
      const picture =
        profile.photos && profile.photos.length > 0
          ? profile.photos[0].value
          : null;

      user = await User.create(
        {
          email,
          email_confirmed: true, // We trust OAuth providers to verify email
          password: null, // No password for OAuth users
          is_active: true,
          is_locked: false,
          failed_login_attempts: 0,
          profile: [
            {
              attribute_key: 'display_name',
              attribute_value: displayName,
            },
            ...(picture
              ? [{ attribute_key: 'picture', attribute_value: picture }]
              : []),
          ],
        },
        {
          include: [
            {
              model: UserProfile,
              as: 'profile',
              required: false,
            },
          ],
        },
      );

      // Assign default role
      const defaultRole = await Role.findOne({
        where: { name: defaultRoleName },
      });
      if (defaultRole) {
        await user.addRole(defaultRole);
      }

      await hook('auth').emit('registered', { user_id: user.id, email, user });
    }

    // Link the oauth account mapping
    await UserLogin.create({
      user_id: user.id,
      name: provider,
      key: profile.id,
    });
  }

  // Refetch user with full RBAC scope like authenticateUser does
  const completeUser = await User.findOne({
    where: { id: user.id },
    include: userFullIncludes(models, {
      includePermissions: true,
      roleAttributes: ['name'],
      groupAttributes: ['name'],
    }),
  });

  if (!completeUser.is_active) {
    const error = new Error('User inactive');
    error.name = 'UserInactiveError';
    error.status = 403;
    throw error;
  }

  if (completeUser.is_locked) {
    const error = new Error('User locked');
    error.name = 'UserLockedError';
    error.status = 403;
    throw error;
  }

  // Reset failed login attempts on successful login
  if (completeUser.failed_login_attempts > 0) {
    await completeUser.update({ failed_login_attempts: 0 });
  }

  // Update user's last login
  await User.update(
    { last_login_at: new Date() },
    { where: { id: completeUser.id } },
  );

  // Format user response
  const normalizedUser = await formatUserResponse(completeUser, {
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  });

  await hook('auth').emit('logged_in', {
    user_id: completeUser.id,
    activitiesData: { provider },
    user: normalizedUser,
  });

  return normalizedUser;
}

/**
 * Stop impersonating and return to original identity
 *
 * @param {string} impersonator_id - Original admin ID
 * @param {Object} options - Options object
 * @returns {Promise<Object>} Formatted user object
 */
export async function stopImpersonating(impersonator_id, options = {}) {
  const {
    models,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = options;
  const { User } = models;

  const user = await User.findByPk(impersonator_id, {
    include: userFullIncludes(models, {
      includePermissions: true,
      roleAttributes: ['name'],
      groupAttributes: ['name'],
    }),
  });

  if (!user) {
    const error = new Error('Original user not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  return formatUserResponse(user, {
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  });
}
