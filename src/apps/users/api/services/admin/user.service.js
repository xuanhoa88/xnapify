/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import * as rbacCache from '../../utils/rbac/cache';
import { fetchUserRBACData } from '../../utils/rbac/fetcher';
import { logUserActivity } from '../../utils/activity';

/**
 * Create a new user
 *
 * @param {Object} userData - User data
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Created user
 * @throws {Error} If UserAlreadyExistsError
 */
export async function createUser(
  userData,
  { models, webhook, actorId, defaultRoleName },
) {
  const { User, UserProfile, Role, Group } = models;
  const { email, password, roles, groups, is_active = true } = userData;

  const { display_name, first_name, last_name } = userData.profile || {};

  // Check if user exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const error = new Error('User already exists');
    error.name = 'UserAlreadyExistsError';
    throw error;
  }

  // Create user with profile (password hashed automatically by model hook)
  const user = await User.create(
    {
      email,
      password,
      is_active,
      email_confirmed: true, // Admin created users are auto-confirmed
      profile: {
        display_name: display_name || email.split('@')[0],
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
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
    const defaultRole = await Role.findOne({
      where: { name: defaultRoleName },
    });
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
  await user.reload({
    include: [
      {
        model: UserProfile,
        as: 'profile',
        required: false,
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

  // Log activity
  await logUserActivity(webhook, 'created', user.id, { email }, actorId);

  return {
    id: user.id,
    email: user.email,
    email_confirmed: user.email_confirmed,
    is_active: user.is_active,
    created_at: user.created_at,
    profile: user.profile || {},
    roles:
      Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles.map(r => r.name)
        : [defaultRoleName],
    groups: user.groups || [],
  };
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
 * @param {string} options.group - Filter by group (default: '')
 * @param {Object} ctx - Context
 * @param {Object} ctx.models - Database models
 * @param {Object} ctx.hook - Webhook engine for activity logging
 * @returns {Promise<Object>} Users with pagination info
 */
export async function getUserList(options, ctx) {
  const {
    page = 1,
    limit = 10,
    search = '',
    role = '',
    status = '',
    group = '',
  } = options;
  const offset = (page - 1) * limit;
  const { User, UserProfile, Role, Group } = ctx.models;

  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  // Build where conditions
  const whereConditions = {};
  const roleWhereConditions = {};
  const groupWhereConditions = {};

  // Search in email and display name
  if (search) {
    // Correlated subquery — no round-trip, no memory overhead
    const profileSubquery = sequelize.dialect.queryGenerator
      .selectQuery(UserProfile.tableName, {
        attributes: ['user_id'],
        where: {
          attribute_key: {
            [Op.in]: ['display_name', 'first_name', 'last_name'],
          },
          attribute_value: { [Op.like]: `%${search}%` },
        },
      })
      .slice(0, -1); // strip trailing semicolon

    whereConditions[Op.or] = [
      { email: { [Op.like]: `%${search}%` } },
      { id: { [Op.in]: sequelize.literal(`(${profileSubquery})`) } },
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

  // Emit event for plugins to modify where conditions
  await ctx
    .hook('admin:users')
    .emit('list:before', whereConditions, { sequelize });

  // Get users with pagination and search
  const [count, users] = await Promise.all([
    User.count({
      where: whereConditions,
      include: [
        role && {
          model: Role,
          as: 'roles',
          where: roleWhereConditions,
          required: true,
        },
        group && {
          model: Group,
          as: 'groups',
          where: groupWhereConditions,
          required: true,
        },
      ].filter(Boolean),
      distinct: true,
      col: 'id',
    }),
    User.findAll({
      where: whereConditions,
      include: [
        {
          model: UserProfile,
          as: 'profile',
          // Do not filter the include itself, otherwise the returned Profile object
          // will only contain the matching attributes instead of the full profile.
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
      col: 'id',
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    }),
  ]);

  const formattedUsers = users.map(user => {
    const plain = user.toJSON();
    return {
      ...plain,
      roles:
        Array.isArray(plain.roles) && plain.roles.length > 0
          ? plain.roles.map(r => r.name)
          : [options.defaultRoleName],
      groups: plain.groups || [],
    };
  });

  // Emit event for plugins to modify formatted users
  await ctx.hook('admin:users').emit('list:after', formattedUsers);

  return {
    users: formattedUsers,
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
export async function getUserById(user_id, { models, defaultRoleName }) {
  const { User, UserProfile, Group, Role } = models;

  const user = await User.findByPk(user_id, {
    include: [
      {
        model: UserProfile,
        as: 'profile',
        required: false,
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

  return {
    id: user.id,
    email: user.email,
    email_confirmed: user.email_confirmed,
    is_active: user.is_active,
    is_locked: user.is_locked,
    failed_login_attempts: user.failed_login_attempts,
    created_at: user.created_at,
    updated_at: user.updated_at,
    profile: user.profile || {},
    roles:
      Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles.map(r => r.name)
        : [defaultRoleName],
    groups: user.groups || [],
  };
}

/**
 * Update user by admin
 *
 * @param {string} user_id - User ID
 * @param {Object} userData - User data to update
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated user with profile
 * @throws {Error} If UserNotFoundError or UserAlreadyExistsError
 */
export async function updateUserById(
  user_id,
  userData,
  { models, webhook, actorId, defaultRoleName },
) {
  const { User, UserProfile, Role, Group } = models;

  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  const { email, password, roles, groups, is_active } = userData;

  const { display_name, first_name, last_name, bio, location, website } =
    userData.profile || {};

  const user = await User.findByPk(user_id, {
    include: [
      {
        model: UserProfile,
        as: 'profile',
        required: false,
      },
    ],
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
    const upsertPromises = Object.entries(profileUpdates).map(
      ([key, value]) => {
        return UserProfile.upsert({
          user_id,
          attribute_key: key,
          attribute_value: value,
        });
      },
    );
    await Promise.all(upsertPromises);
  }

  // Update roles if provided
  if (roles != null && Array.isArray(roles)) {
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
  if (groups != null && Array.isArray(groups)) {
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

  // Invalidate RBAC cache (roles/groups may have changed)
  rbacCache.invalidateUser(user_id);

  // Reload user with updated data
  await user.reload({
    include: [
      {
        model: UserProfile,
        as: 'profile',
        required: false,
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

  // Log activity
  await logUserActivity(
    webhook,
    'updated',
    user_id,
    { email: user.email },
    actorId,
  );

  return {
    id: user.id,
    email: user.email,
    email_confirmed: user.email_confirmed,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
    profile: user.profile || {},
    roles:
      Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles.map(r => r.name)
        : [defaultRoleName],
    groups: user.groups || [],
  };
}

/**
 * Get user statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User statistics
 */
export async function getUserStats(models) {
  const { User, UserLogin } = models;

  const { sequelize } = User;
  const { Op, fn, col } = sequelize.Sequelize;

  // Get user counts
  const totalUsers = await User.count();
  const activeUsers = await User.count({ where: { is_active: true } });
  const inactiveUsers = await User.count({ where: { is_active: false } });
  const lockedUsers = await User.count({ where: { is_locked: true } });
  const verifiedUsers = await User.count({ where: { email_confirmed: true } });

  // Get role distribution
  const roleStats = await User.findAll({
    attributes: ['role', [fn('COUNT', col('role')), 'count']],
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

/**
 * Bulk update user status
 *
 * @param {string[]} ids - Array of user IDs
 * @param {boolean} is_active - New status
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated users
 */
export async function bulkUpdateStatus(
  ids,
  is_active,
  { models, webhook, actorId },
) {
  const { User } = models;
  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  // Update all users
  await User.update({ is_active }, { where: { id: { [Op.in]: ids } } });

  // Fetch updated users
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
  });

  // Log activity and invalidate cache for each user concurrently
  const action = is_active ? 'activated' : 'deactivated';
  await Promise.all(
    users.map(user => {
      // Invalidate RBAC cache
      rbacCache.invalidateUser(user.id);
      return logUserActivity(
        webhook,
        action,
        user.id,
        { email: user.email },
        actorId,
      );
    }),
  );

  return {
    users,
    updated: users.length,
  };
}

/**
 * Bulk delete users
 *
 * @param {string[]} ids - Array of user IDs to delete
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Result with deleted count
 */
export async function bulkDelete(ids, { models, webhook, actorId }) {
  const { User } = models;
  const { sequelize } = User;
  const { Op } = sequelize.Sequelize;

  // Find users to delete
  const usersToDelete = await User.findAll({
    where: { id: { [Op.in]: ids } },
  });

  const deletedIds = usersToDelete.map(u => u.id);
  const deletedEmails = usersToDelete.map(u => u.email);

  // Delete users
  if (deletedIds.length > 0) {
    await User.destroy({
      where: { id: { [Op.in]: deletedIds } },
    });

    // Log activity and invalidate cache for each deleted user concurrently
    await Promise.all(
      deletedIds.map((id, i) => {
        // Invalidate RBAC cache
        rbacCache.invalidateUser(id);
        return logUserActivity(
          webhook,
          'deleted',
          id,
          { email: deletedEmails[i] },
          actorId,
        );
      }),
    );
  }

  return {
    deleted: deletedIds.length,
    deletedIds,
  };
}

/**
 * List API keys for a user
 *
 * @param {string} userId - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Array>} List of API keys
 */
export async function listApiKeys(userId, models) {
  const { UserApiKey } = models;
  return UserApiKey.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });
}

/**
 * Create a new API key for a user
 *
 * @param {string} userId - User ID
 * @param {Object} data - Key data
 * @param {string} data.name - Key name
 * @param {string[]} [data.scopes] - Scopes
 * @param {number} [data.expiresIn] - Expiration in days
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {Object} options.jwt - JWT service
 * @returns {Promise<Object>} Created key and raw token
 */
export async function createApiKey(userId, data, { models, jwt }) {
  const { name, scopes: requestedScopes = [], expiresIn, cache } = data;
  const { UserApiKey } = models;

  // Fetch user's effective permissions (resource:action format)
  const rbacData = await fetchUserRBACData(userId, { models, cache });
  const userPermissions = rbacData.permissions;

  // Intersect requested scopes with user's permissions, or inherit all if none selected
  const scopes =
    requestedScopes.length > 0
      ? requestedScopes.filter(s => userPermissions.includes(s))
      : userPermissions;

  // Generate a UUID that links the JWT to the DB record
  const keyId = uuidv4();

  // Calculate expiration (default to 365 days if not provided)
  const days = expiresIn || 365;
  const expiresAt = dayjs().add(days, 'day').toDate();

  // Generate JWT with type: 'api_key' and our DB id as jti
  const token = jwt.generateToken(
    {
      id: userId,
      email: rbacData.email,
      jti: keyId,
      scopes,
      type: 'api_key',
    },
    { expiresIn: `${days}d` },
  );

  // Store metadata in DB
  const newKey = await UserApiKey.create({
    id: keyId,
    user_id: userId,
    name,
    scopes,
    is_active: true,
    expires_at: expiresAt,
    token_prefix: token.substring(0, 10),
  });

  return { key: newKey, token };
}

/**
 * Revoke an API key
 *
 * @param {string} userId - User ID
 * @param {string} keyId - API Key ID
 * @param {Object} models - Database models
 * @returns {Promise<void>}
 * @throws {Error} If key not found
 */
export async function revokeApiKey(userId, keyId, models) {
  const { UserApiKey } = models;

  const key = await UserApiKey.findOne({
    where: { id: keyId, user_id: userId },
  });

  if (!key) {
    const error = new Error('API Key not found');
    error.name = 'ApiKeyNotFoundError';
    error.status = 404;
    throw error;
  }

  await key.update({ is_active: false });
}
