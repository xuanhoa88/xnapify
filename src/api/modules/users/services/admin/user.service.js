/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ROLE } from '../../constants/rbac';

/**
 * Create a new user
 *
 * @param {Object} userData - User data
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Created user
 * @throws {Error} If UserAlreadyExistsError
 */
export async function createUser(userData, models) {
  const { User, UserProfile, Role, Group } = models;
  const {
    email,
    password,
    display_name,
    first_name,
    last_name,
    roles,
    groups,
    is_active = true,
  } = userData;

  // Check if user exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const error = new Error('User already exists');
    error.name = 'UserAlreadyExistsError';
    throw error;
  }

  // Create user (password hashed automatically by model hook)
  const user = await User.create({
    email,
    password,
    is_active,
    email_confirmed: true, // Admin created users are auto-confirmed
  });

  // Create profile
  await UserProfile.create({
    user_id: user.id,
    display_name: display_name || email.split('@')[0],
    first_name,
    last_name,
  });

  // Assign role
  if (Array.isArray(roles) && roles.length > 0) {
    const roleRecords = await Role.findAll({
      where: { name: roles },
    });
    if (roleRecords.length > 0) {
      await user.addRoles(roleRecords);
    }
  } else {
    // Default role
    const defaultRole = await Role.findOne({ where: { name: DEFAULT_ROLE } });
    if (defaultRole) {
      await user.addRole(defaultRole);
    }
  }

  // Assign groups
  if (Array.isArray(groups) && groups.length > 0) {
    const groupRecords = await Group.findAll({
      where: { id: groups },
    });
    if (groupRecords.length > 0) {
      await user.addGroups(groupRecords);
    }
  }

  // Reload with associations
  return user.reload({
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
  });
}

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
  const {
    page = 1,
    limit = 10,
    search = '',
    role = '',
    status = '',
    group = '',
  } = options;
  const offset = (page - 1) * limit;
  const { User, UserProfile, Role, Group } = models;

  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  // Build where conditions
  const whereConditions = {};
  const profileWhereConditions = {};
  const roleWhereConditions = {};
  const groupWhereConditions = {};

  // Search in email and display name
  if (search) {
    whereConditions[Op.or] = [{ email: { [Op.like]: `%${search}%` } }];
    profileWhereConditions[Op.or] = [
      { display_name: { [Op.like]: `%${search}%` } },
      { first_name: { [Op.like]: `%${search}%` } },
      { last_name: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter by role
  if (role) {
    roleWhereConditions.name = role;
  }

  // Filter by group
  if (group) {
    groupWhereConditions.name = group;
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
      {
        model: Role,
        as: 'roles',
        where: role ? roleWhereConditions : undefined,
        required: !!role,
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        where: group ? groupWhereConditions : undefined,
        required: !!group,
        attributes: ['id', 'name', 'description', 'category', 'type'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
    distinct: true,
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
 * @throws {Error} If UserNotFoundError
 */
export async function getUserById(user_id, models) {
  const { User, UserProfile, Group, Role } = models;

  const user = await User.findByPk(user_id, {
    include: [
      {
        model: UserProfile,
        as: 'profile',
      },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description', 'category', 'type'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
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

  return user;
}

/**
 * Update user by admin
 *
 * @param {string} user_id - User ID
 * @param {Object} userData - User data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError or UserAlreadyExistsError
 */
export async function updateUserById(user_id, userData, models) {
  const { User, UserProfile, Role, Group } = models;

  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  const {
    email,
    password,
    display_name,
    first_name,
    last_name,
    bio,
    location,
    website,
    roles,
    groups,
    is_active,
  } = userData;

  const user = await User.findByPk(user_id, {
    include: [{ model: UserProfile, as: 'profile' }],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await User.findOne({
      where: { email, id: { [Op.ne]: user_id } },
    });
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.name = 'UserAlreadyExistsError';
      error.status = 409;
      throw error;
    }
  }

  // Update user fields
  const userUpdates = {};
  if (email) userUpdates.email = email;
  if (password) userUpdates.password = password; // Password hashed by model hook
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

  // Update roles if provided
  if (roles !== undefined && Array.isArray(roles)) {
    // Remove all existing roles
    await user.setRoles([]);

    // Add new roles
    if (roles.length > 0) {
      const roleRecords = await Role.findAll({
        where: { name: roles },
      });
      if (roleRecords.length > 0) {
        await user.addRoles(roleRecords);
      }
    }
  }

  // Update groups if provided
  if (groups !== undefined && Array.isArray(groups)) {
    // Remove all existing groups
    await user.setGroups([]);

    // Add new groups
    if (groups.length > 0) {
      const groupRecords = await Group.findAll({
        where: { id: groups },
      });
      if (groupRecords.length > 0) {
        await user.addGroups(groupRecords);
      }
    }
  }

  // Reload user with updated data
  await user.reload({
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['id', 'name', 'description'],
            through: { attributes: [] },
          },
        ],
      },
    ],
  });

  return user;
}

/**
 * Delete user by admin
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If UserNotFoundError
 */
export async function deleteUserById(user_id, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Delete user (cascade will handle related records)
  await user.destroy();

  return true;
}

/**
 * Update user status (active/inactive)
 *
 * @param {string} user_id - User ID
 * @param {boolean} is_active - Active status
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If UserNotFoundError
 */
export async function updateUserStatus(user_id, is_active, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
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
 * @throws {Error} If UserNotFoundError
 */
export async function updateUserLockStatus(user_id, is_locked, reason, models) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
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

  const { sequelize } = models;
  const { Op } = sequelize.Sequelize;

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
        [Op.gte]: thirtyDaysAgo,
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
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
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
 * Reset user password (admin action)
 *
 * @param {string} user_id - User ID
 * @param {string} newPassword - New password
 * @param {Object} {models} - Database models
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If UserNotFoundError
 */
export async function resetUserPassword(user_id, newPassword, { models }) {
  const { User } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Update password (hashed automatically by model hook)
  await user.update({
    password: newPassword,
    failed_login_attempts: 0,
    is_locked: false,
  });

  return user;
}
