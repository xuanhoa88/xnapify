/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  hashToken,
  verifyPassword,
  createTimedResetToken,
  validateResetToken,
} from '../utils/password';
import { logUserActivity } from '../utils/activity';
import { formatUserResponse } from '../utils/formatter';

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<Object>} Formatted user object with RBAC data
 * @throws {Error} If user already exists or creation fails
 */
export async function registerUser(
  userData,
  {
    models,
    webhook,
    searchWorker,
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
      profile: {
        display_name: userData.display_name || email.split('@')[0],
      },
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

  // Log registration activity
  await logUserActivity(webhook, 'registered', user.id, { email }, null, {
    useWorker: true,
  });

  // Emit hook event if hook factory provided
  await hook('auth').emit('registered', { user_id: user.id, email });

  // Index user in search
  if (searchWorker) {
    await searchWorker.indexUser(user);
  }

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
 * Log user logout activity
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<void>}
 */
export async function logoutUser(user_id, { webhook, hook } = {}) {
  await logUserActivity(webhook, 'logout', user_id, {}, null, {
    useWorker: true,
  });

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
 * @param {Object} options.webhook - Webhook engine instance (optional)
 * @param {Object} options.activityData - Activity data (optional)
 * @returns {Promise<Object>} Formatted user object with RBAC data
 * @throws {Error} If credentials are invalid
 */
export async function authenticateUser(
  email,
  password,
  {
    models,
    webhook,
    activityData,
    hook,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = {},
) {
  const { User, UserProfile, Role, Permission, Group } = models;

  // Find user with password and full RBAC data in ONE query
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: [
      {
        model: UserProfile,
        as: 'profile',
      },
      {
        model: Role,
        as: 'roles',
        attributes: ['name'],
        through: { attributes: [] },
        include: [
          {
            model: Permission,
            as: 'permissions',
            attributes: ['resource', 'action'],
            where: { is_active: true },
            required: false,
            through: { attributes: [] },
          },
        ],
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['name'],
        required: false,
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['name'],
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                attributes: ['resource', 'action'],
                where: { is_active: true },
                required: false,
                through: { attributes: [] },
              },
            ],
          },
        ],
      },
    ],
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

  // Log login activity
  await logUserActivity(
    webhook,
    'login',
    user.id,
    { ...activityData, success: true },
    null,
    { useWorker: true },
  );

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
    activityData,
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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid or expired
 */
export async function verifyEmail(token, { models, webhook, hook } = {}) {
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

    // Log email verified activity
    await logUserActivity(
      webhook,
      'email_verified',
      user.id,
      { email: user.email },
      null,
      { useWorker: true },
    );

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<Object>} Reset token info (token for email, message)
 */
export async function resetPasswordRequest(
  email,
  { models, webhook, hook } = {},
) {
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

  // Log password reset request activity
  await logUserActivity(
    webhook,
    'password_reset_requested',
    user.id,
    { email },
    null,
    { useWorker: true },
  );

  // Emit hook event if hook factory provided
  await hook('auth').emit('password_reset_requested', {
    user_id: user.id,
    email,
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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid, expired, or already used
 */
export async function resetPasswordConfirmation(
  token,
  newPassword,
  { models, webhook, hook } = {},
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

  // Log password reset completed activity
  await logUserActivity(
    webhook,
    'password_reset_completed',
    user.id,
    {},
    null,
    { useWorker: true },
  );

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
    webhook,
    searchWorker,
    hook,
    defaultRoleName,
    adminRoleName,
    defaultResources,
    defaultActions,
  } = {},
) {
  const { User, UserLogin, UserProfile, Role, Permission, Group } = models;

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
          profile: {
            display_name: displayName,
            picture,
          },
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

      await logUserActivity(
        webhook,
        'registered',
        user.id,
        { email, provider },
        null,
        {
          useWorker: true,
        },
      );

      await hook('auth').emit('registered', { user_id: user.id, email });

      if (searchWorker) {
        await searchWorker.indexUser(user);
      }
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
    include: [
      {
        model: UserProfile,
        as: 'profile',
      },
      {
        model: Role,
        as: 'roles',
        attributes: ['name'],
        through: { attributes: [] },
        include: [
          {
            model: Permission,
            as: 'permissions',
            attributes: ['resource', 'action'],
            where: { is_active: true },
            required: false,
            through: { attributes: [] },
          },
        ],
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['name'],
        required: false,
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['name'],
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                attributes: ['resource', 'action'],
                where: { is_active: true },
                required: false,
                through: { attributes: [] },
              },
            ],
          },
        ],
      },
    ],
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

  // Log login activity
  await logUserActivity(
    webhook,
    'login',
    completeUser.id,
    { success: true, provider },
    null,
    { useWorker: true },
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
    activityData: { provider },
    user: normalizedUser,
  });

  return normalizedUser;
}
