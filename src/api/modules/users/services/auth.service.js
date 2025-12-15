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
import { DEFAULT_ROLE, isAdmin } from '../constants/roles';

// ========================================================================
// AUTHENTICATION SERVICES
// ========================================================================

/**
 * Get current user with complete RBAC information
 *
 * Fetches user data including profile, roles, permissions, and groups.
 * This is the centralized function used by login, register, and me endpoints
 * to ensure consistent user data formatting.
 *
 * @param {string} userId - User ID to fetch
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Formatted user object with RBAC data
 */
export async function getCurrentUser(userId, models) {
  const { User, UserProfile, Role, Permission, Group } = models;

  // Get user with profile, roles, permissions, and groups
  const user = await User.findByPk(userId, {
    include: [
      {
        model: UserProfile,
        as: 'profile',
      },
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] }, // Exclude junction table attributes
        include: [
          {
            model: Permission,
            as: 'permissions',
            through: { attributes: [] },
          },
        ],
      },
      {
        model: Group,
        as: 'groups',
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
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

  // Collect all permissions from direct roles and group roles
  const permissionsSet = new Set();
  const rolesSet = new Set();

  // Add permissions from direct user roles
  if (user.roles) {
    for (const role of user.roles) {
      rolesSet.add(role.name);
      if (role.permissions) {
        for (const perm of role.permissions) {
          permissionsSet.add(perm.name);
        }
      }
    }
  }

  // Add permissions from group roles
  if (user.groups) {
    for (const group of user.groups) {
      if (group.roles) {
        for (const role of group.roles) {
          rolesSet.add(role.name);
          if (role.permissions) {
            for (const perm of role.permissions) {
              permissionsSet.add(perm.name);
            }
          }
        }
      }
    }
  }

  // RBAC logic: Determine roles, permissions, and is_admin
  const allRoles = Array.from(rolesSet);
  const allPermissions = Array.from(permissionsSet);

  // Return formatted user object
  return {
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
    is_admin: isAdmin({ roles: allRoles }),
    roles: allRoles,
    permissions: allPermissions,
    groups: user.groups
      ? user.groups.map(group => ({
          id: group.id,
          name: group.name,
          description: group.description,
        }))
      : [],
  };
}

/**
 * Register a new user
 *
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.display_name - User display name (optional)
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} Created user with profile
 * @throws {Error} If user already exists or creation fails
 */
export async function registerUser(userData, { models }) {
  const { email, password, display_name } = userData;
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
        display_name: display_name || email.split('@')[0],
      },
    },
    {
      include: [{ model: UserProfile, as: 'profile' }],
    },
  );

  // Assign default role
  const defaultRole = await Role.findOne({ where: { name: DEFAULT_ROLE } });
  if (defaultRole) {
    await user.addRole(defaultRole);
  }

  return user;
}

/**
 * Authenticate user with email and password
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} User with profile
 * @throws {Error} If credentials are invalid
 */
export async function authenticateUser(email, password, { models }) {
  const { User, UserProfile } = models;

  // Find user with password (need to verify it)
  const user = await User.scope('withPassword').findOne({
    where: { email },
    include: [
      {
        model: UserProfile,
        as: 'profile',
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

  // Log successful login
  await updateLastLogin(
    user.id,
    { ip_address: null, user_agent: null },
    models,
  );

  return user;
}

/**
 * Verify email address with token
 *
 * @param {string} token - Email verification token
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid or expired
 */
export async function verifyEmail(token, models) {
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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Reset token info (token for email, message)
 */
export async function requestResetPassword(email, models) {
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
  { models },
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

  return user;
}

/**
 * Update user's last login timestamp
 *
 * @param {string} user_id - User ID
 * @param {Object} loginData - Login data (IP, user agent, etc.)
 * @param {Object} models - Database models
 * @returns {Promise<void>}
 */
export async function updateLastLogin(user_id, loginData, models) {
  const { User, UserLogin } = models;

  // Update user's last login
  await User.update({ last_login_at: new Date() }, { where: { id: user_id } });

  // Create login record
  await UserLogin.create({
    user_id,
    name: 'local',
    key: user_id,
    ip_address: loginData.ip_address,
    user_agent: loginData.user_agent,
    login_at: new Date(),
    success: true,
  });
}

/**
 * Check if user account is locked
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if account is locked
 */
export async function isAccountLocked(user_id, models) {
  const { User } = models;

  const user = await User.findByPk(user_id, {
    attributes: ['is_locked', 'failed_login_attempts'],
  });

  return user ? user.is_locked : false;
}

/**
 * Unlock user account
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 */
export async function unlockAccount(user_id, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  await user.update({
    is_locked: false,
    failed_login_attempts: 0,
  });

  return user;
}
