/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { hashPassword } from '../utils/password';

/**
 * Get users with pagination and search
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.search - Search term (default: '')
 * @param {string} options.role - Filter by role (default: '')
 * @param {string} options.status - Filter by status (default: '')
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Users with pagination info
 */
export async function getUserList(options, models) {
  const { page = 1, limit = 10, search = '', role = '', status = '' } = options;
  const offset = (page - 1) * limit;
  const { User, UserProfile } = models;

  // Build where conditions
  const whereConditions = {};
  const profileWhereConditions = {};

  // Search in email and display name
  if (search) {
    whereConditions[models.Sequelize.Op.or] = [
      { email: { [models.Sequelize.Op.iLike]: `%${search}%` } },
    ];
    profileWhereConditions[models.Sequelize.Op.or] = [
      { display_name: { [models.Sequelize.Op.iLike]: `%${search}%` } },
      { first_name: { [models.Sequelize.Op.iLike]: `%${search}%` } },
      { last_name: { [models.Sequelize.Op.iLike]: `%${search}%` } },
    ];
  }

  // Filter by role
  if (role) {
    whereConditions.role = role;
  }

  // Filter by status
  if (status === 'active') {
    whereConditions.is_active = true;
  } else if (status === 'inactive') {
    whereConditions.is_active = false;
  } else if (status === 'locked') {
    whereConditions.is_locked = true;
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: UserProfile,
        as: 'profile',
        where: search ? profileWhereConditions : undefined,
        required: false,
      },
    ],
    attributes: { exclude: ['password'] },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['created_at', 'DESC']],
  });

  return {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get user by ID with full details
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User with profile and additional details
 * @throws {Error} If USER_NOT_FOUND
 */
export async function getUserById(user_id, models) {
  const { User, UserProfile, UserLogin } = models;

  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
    attributes: { exclude: ['password'] },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Get additional stats
  const loginCount = UserLogin
    ? await UserLogin.count({
        where: { user_id, success: true },
      })
    : 0;

  const lastLogin = UserLogin
    ? await UserLogin.findOne({
        where: { user_id, success: true },
        order: [['login_at', 'DESC']],
        attributes: ['login_at', 'ip_address'],
      })
    : null;

  return {
    ...user.toJSON(),
    stats: {
      loginCount,
      lastLogin: (lastLogin && lastLogin.login_at) || null,
      lastLoginIp: (lastLogin && lastLogin.ip_address) || null,
    },
  };
}

/**
 * Update user by admin
 *
 * @param {string} user_id - User ID
 * @param {Object} userData - User data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If USER_NOT_FOUND or USER_ALREADY_EXISTS
 */
export async function updateUserById(user_id, userData, models) {
  const { User, UserProfile } = models;
  const {
    email,
    display_name,
    first_name,
    last_name,
    bio,
    location,
    website,
    role,
    is_active,
  } = userData;

  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await User.findOne({
      where: { email, id: { [models.Sequelize.Op.ne]: user_id } },
    });
    if (existingUser) {
      throw new Error('USER_ALREADY_EXISTS');
    }
  }

  // Update user fields
  const userUpdates = {};
  if (email) userUpdates.email = email;
  if (role) userUpdates.role = role;
  if (typeof is_active === 'boolean') userUpdates.is_active = is_active;

  if (Object.keys(userUpdates).length > 0) {
    await user.update(userUpdates);
  }

  // Update profile fields
  const profileUpdates = {};
  if (display_name != null) profileUpdates.display_name = display_name;
  if (first_name != null) profileUpdates.first_name = first_name;
  if (last_name != null) profileUpdates.last_name = last_name;
  if (bio != null) profileUpdates.bio = bio;
  if (location != null) profileUpdates.location = location;
  if (website != null) profileUpdates.website = website;

  if (Object.keys(profileUpdates).length > 0) {
    if (user.profile) {
      await user.profile.update(profileUpdates);
    } else {
      await UserProfile.create({
        user_id,
        ...profileUpdates,
      });
    }
  }

  // Reload user with updated data
  await user.reload({
    include: [{ model: UserProfile, as: 'profile' }],
    attributes: { exclude: ['password'] },
  });

  return user;
}

/**
 * Delete user by admin
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If USER_NOT_FOUND
 */
export async function deleteUserById(user_id, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Delete user (cascade will handle related records)
  await user.destroy();

  return true;
}

/**
 * Update user role
 *
 * @param {string} user_id - User ID
 * @param {string} role - New role
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If USER_NOT_FOUND
 */
export async function updateUserRole(user_id, role, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  await user.update({ role });

  return user;
}

/**
 * Update user status (active/inactive)
 *
 * @param {string} user_id - User ID
 * @param {boolean} is_active - Active status
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If USER_NOT_FOUND
 */
export async function updateUserStatus(user_id, is_active, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  await user.update({ is_active });

  return user;
}

/**
 * Update user lock status
 *
 * @param {string} user_id - User ID
 * @param {boolean} is_locked - Lock status
 * @param {string} reason - Lock reason (optional)
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If USER_NOT_FOUND
 */
export async function updateUserLockStatus(user_id, is_locked, reason, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const updates = {
    is_locked,
    lockReason: is_locked ? reason : null,
  };

  // Reset failed login attempts when unlocking
  if (!is_locked) {
    updates.failed_login_attempts = 0;
  }

  await user.update(updates);

  return user;
}

/**
 * Get user statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User statistics
 */
export async function getUserStats(models) {
  const { User, UserLogin } = models;

  // Get user counts
  const totalUsers = await User.count();
  const activeUsers = await User.count({ where: { is_active: true } });
  const inactiveUsers = await User.count({ where: { is_active: false } });
  const lockedUsers = await User.count({ where: { is_locked: true } });
  const verifiedUsers = await User.count({ where: { email_confirmed: true } });

  // Get role distribution
  const roleStats = await User.findAll({
    attributes: [
      'role',
      [models.Sequelize.fn('COUNT', models.Sequelize.col('role')), 'count'],
    ],
    group: ['role'],
    raw: true,
  });

  // Get recent registrations (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentRegistrations = await User.count({
    where: {
      created_at: {
        [models.Sequelize.Op.gte]: thirtyDaysAgo,
      },
    },
  });

  // Get login statistics (if UserLogin model exists)
  let loginStats = null;
  if (UserLogin) {
    const totalLogins = await UserLogin.count({ where: { success: true } });
    const uniqueLoginsToday = await UserLogin.count({
      distinct: true,
      col: 'user_id',
      where: {
        success: true,
        login_at: {
          [models.Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    loginStats = {
      totalLogins,
      uniqueLoginsToday,
    };
  }

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      locked: lockedUsers,
      verified: verifiedUsers,
      recentRegistrations,
    },
    roles: roleStats.reduce((acc, stat) => {
      acc[stat.role] = parseInt(stat.count);
      return acc;
    }, {}),
    logins: loginStats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Bulk update users
 *
 * @param {string[]} user_ids - Array of user IDs
 * @param {Object} updates - Updates to apply
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Update result
 */
export async function bulkUpdateUsers(user_ids, updates, models) {
  const { User, UserProfile } = models;

  // Separate user and profile updates
  const userUpdates = {};
  const profileUpdates = {};

  // User fields
  if (updates.role) userUpdates.role = updates.role;
  if (typeof updates.is_active === 'boolean')
    userUpdates.is_active = updates.is_active;
  if (typeof updates.is_locked === 'boolean')
    userUpdates.is_locked = updates.is_locked;

  // Profile fields
  if (updates.display_name != null)
    profileUpdates.display_name = updates.display_name;
  if (updates.first_name != null)
    profileUpdates.first_name = updates.first_name;
  if (updates.last_name != null) profileUpdates.last_name = updates.last_name;

  let updatedCount = 0;

  // Update users
  if (Object.keys(userUpdates).length > 0) {
    const [affectedRows] = await User.update(userUpdates, {
      where: { id: user_ids },
    });
    updatedCount = affectedRows;
  }

  // Update profiles
  if (Object.keys(profileUpdates).length > 0) {
    await UserProfile.update(profileUpdates, {
      where: { user_id: user_ids },
    });
  }

  return {
    updatedCount,
    user_ids,
    updates: { ...userUpdates, ...profileUpdates },
  };
}

/**
 * Reset user password (admin action)
 *
 * @param {string} user_id - User ID
 * @param {string} newPassword - New password
 * @param {Object} {models} - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If USER_NOT_FOUND
 */
export async function resetUserPassword(user_id, newPassword, { models }) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password and reset security fields
  await user.update({
    password: hashedPassword,
    failed_login_attempts: 0,
    is_locked: false,
  });

  return user;
}
