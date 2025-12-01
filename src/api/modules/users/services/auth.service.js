/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { hashPassword, verifyPassword } from '../utils/password';
import { SYSTEM_ROLES } from '../constants/roles';

// ========================================================================
// AUTHENTICATION SERVICES
// ========================================================================

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
  const { User, UserProfile } = models;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  // Hash password using global auth utilities
  const hashedPassword = await hashPassword(password);

  // Create user with profile
  const user = await User.create(
    {
      email,
      email_confirmed: false,
      password: hashedPassword,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      role: SYSTEM_ROLES[0],
      profile: {
        display_name: display_name || email.split('@')[0],
      },
    },
    {
      include: [{ model: UserProfile, as: 'profile' }],
    },
  );

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

  // Find user with profile
  const user = await User.findOne({
    where: { email },
    include: [{ model: UserProfile, as: 'profile' }],
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Check if account is active
  if (!user.is_active) {
    throw new Error('ACCOUNT_INACTIVE');
  }

  // Check if account is locked
  if (user.is_locked) {
    throw new Error('ACCOUNT_LOCKED');
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

    throw new Error('INVALID_CREDENTIALS');
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
      throw new Error('USER_NOT_FOUND');
    }

    if (user.email_confirmed) {
      throw new Error('EMAIL_ALREADY_VERIFIED');
    }

    // Update email confirmation status
    await user.update({ email_confirmed: true });

    return user;
  } catch (error) {
    throw new Error('INVALID_TOKEN');
  }
}

/**
 * Request password reset
 *
 * @param {string} email - User email
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Reset token info
 * @throws {Error} If user not found
 */
export async function requestPasswordReset(email, models) {
  const { User } = models;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Don't reveal if email exists for security
    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Generate reset token (in real implementation, use JWT with expiration)
  const resetToken = user.id; // Simplified - use proper JWT in production

  // In a real implementation, you would:
  // 1. Generate a secure JWT token with expiration
  // 2. Store token hash in database or use stateless JWT
  // 3. Send email with reset link

  return {
    resetToken,
    message: 'Password reset link sent to email',
  };
}

/**
 * Reset password with token
 *
 * @param {string} token - Password reset token
 * @param {string} newPassword - New password
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If token is invalid or expired
 */
export async function resetPassword(token, newPassword, { models }) {
  const { User } = models;

  try {
    // Decode token to get user ID (simplified)
    const user_id = token; // In reality, decode and verify JWT token

    const user = await User.findByPk(user_id);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Hash new password using global auth utilities
    const hashedPassword = await hashPassword(newPassword);

    // Update password and reset failed login attempts
    await user.update({
      password: hashedPassword,
      failed_login_attempts: 0,
      is_locked: false,
    });

    return user;
  } catch (error) {
    throw new Error('INVALID_TOKEN');
  }
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
    throw new Error('USER_NOT_FOUND');
  }

  await user.update({
    is_locked: false,
    failed_login_attempts: 0,
  });

  return user;
}
