/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  SYSTEM_ROLES,
  DEFAULT_RESOURCES,
  DEFAULT_ACTIONS,
} from '../../constants/rbac';
import { manageRolePermissions } from './rbac.service';
import * as rbacCache from '../../utils/rbac/cache';
import { logRoleActivity } from '../../utils/activity';

// ========================================================================
// ROLE MANAGEMENT SERVICES
// ========================================================================

/**
 * Create a new role
 *
 * @param {Object} roleData - Role data
 * @param {string} roleData.name - Role name
 * @param {string} roleData.description - Role description
 * @param {Array<string>} roleData.permissions - Role permissions
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Created role
 */
export async function createRole(roleData, { models, webhook, actorId }) {
  const { Role } = models;
  const { name, description, permissions } = roleData;

  // Check if role already exists
  const existingRole = await Role.findOne({ where: { name } });
  if (existingRole) {
    const error = new Error(`Role '${name}' already exists`);
    error.name = 'RoleAlreadyExistsError';
    error.status = 400;
    throw error;
  }

  const role = await Role.create({
    name,
    description,
    is_active: true,
  });

  // Assign permissions if provided
  if (Array.isArray(permissions)) {
    await manageRolePermissions(role.name, permissions, models, 'replace');

    // Reload with permissions
    role.reload();
  }

  // Log activity
  await logRoleActivity(webhook, 'created', role.id, { name }, actorId);

  return role;
}

/**
 * Get all roles with pagination
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Roles with pagination
 */
export async function getRoles(options, models) {
  const { page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  const { Role, Permission, User, Group } = models;

  const { sequelize } = Role;
  const { Op } = sequelize.Sequelize;

  const whereCondition = search
    ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ],
      }
    : {};

  const { count, rows: roles } = await Role.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      },
    ],
    distinct: true, // Fix count inflation from associations
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
  });

  // Get total non-wildcard permissions count (for roles with wildcard)
  const totalPermissionsCount = await Permission.count({
    where: {
      [Op.not]: {
        [Op.and]: [
          { resource: DEFAULT_RESOURCES.ALL },
          { action: DEFAULT_ACTIONS.MANAGE },
        ],
      },
    },
  });

  // Fetch counts for each role
  const rolesWithCounts = await Promise.all(
    roles.map(async role => {
      // Check if role has wildcard permission
      const hasWildcard = role.permissions.some(
        p =>
          p.resource === DEFAULT_RESOURCES.ALL &&
          p.action === DEFAULT_ACTIONS.MANAGE,
      );

      const [usersCount, groupsCount, permissionsCount] = await Promise.all([
        User.count({
          include: [
            {
              model: Role,
              as: 'roles',
              where: { id: role.id },
              required: true,
            },
          ],
        }),
        Group.count({
          include: [
            {
              model: Role,
              as: 'roles',
              where: { id: role.id },
              required: true,
            },
          ],
        }),
        // If wildcard, return total count; otherwise count actual permissions
        hasWildcard
          ? Promise.resolve(totalPermissionsCount)
          : Promise.resolve(
              role.permissions.filter(
                p =>
                  !(
                    p.resource === DEFAULT_RESOURCES.ALL &&
                    p.action === DEFAULT_ACTIONS.MANAGE
                  ),
              ).length,
            ),
      ]);

      return {
        ...role.toJSON(),
        usersCount,
        groupsCount,
        permissionsCount,
      };
    }),
  );

  return {
    roles: rolesWithCounts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get role by ID
 *
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Role with permissions
 */
export async function getRoleById(role_id, models) {
  const { Role, Permission } = models;

  const role = await Role.findByPk(role_id, {
    include: [
      {
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      },
    ],
  });

  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if role has wildcard permission (*:*)
  const wildcardPerm = `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`;
  const hasWildcard = role.permissions.some(
    p => `${p.resource}:${p.action}` === wildcardPerm,
  );

  // If role has wildcard, expand to all individual permissions
  if (hasWildcard) {
    const allPermissions = await Permission.findAll({
      where: {
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });

    // Filter out the wildcard permission itself for UI display
    const filteredPermissions = allPermissions.filter(
      p => `${p.resource}:${p.action}` !== wildcardPerm,
    );

    // Return role with expanded permissions
    return {
      ...role.toJSON(),
      permissions: filteredPermissions.map(p => p.toJSON()),
      hasWildcardPermission: true, // Flag for UI to know this is wildcarded
    };
  }

  return role;
}

/**
 * Update role
 *
 * @param {string} role_id - Role ID
 * @param {Object} updateData - Data to update
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated role
 */
export async function updateRole(
  role_id,
  updateData,
  { models, webhook, actorId },
) {
  const { Role } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Extract permissions and other attributes
  const { permissions, ...attributes } = updateData;

  // Check if name is being changed and if it already exists
  if (attributes.name && attributes.name !== role.name) {
    const existingRole = await Role.findOne({
      where: { name: attributes.name },
    });
    if (existingRole) {
      const error = new Error(`Role '${attributes.name}' already exists`);
      error.name = 'RoleAlreadyExistsError';
      error.status = 400;
      throw error;
    }
  }

  await role.update(updateData);

  // Update permissions if provided
  if (Array.isArray(permissions)) {
    await manageRolePermissions(role.name, permissions, models, 'replace');

    // Reload with permissions
    role.reload();
  }

  // Log activity
  await logRoleActivity(
    webhook,
    'updated',
    role_id,
    { name: role.name },
    actorId,
  );

  return role;
}

/**
 * Delete role
 *
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRole(role_id, { models, webhook, actorId }) {
  const { Role, User } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Prevent deletion of system roles
  if (SYSTEM_ROLES.includes(role.name)) {
    const error = new Error('Cannot delete system roles');
    error.name = 'SystemRoleDeletionError';
    error.status = 400;
    throw error;
  }

  // Get all users with this role before deletion for cache invalidation
  const usersWithRole = await User.findAll({
    include: [{ model: Role, as: 'roles', where: { id: role_id } }],
    attributes: ['id'],
  });

  const roleName = role.name;
  await role.destroy();

  // Log activity
  await logRoleActivity(
    webhook,
    'deleted',
    role_id,
    { name: roleName },
    actorId,
  );

  // Invalidate RBAC cache for affected users
  if (usersWithRole.length > 0) {
    rbacCache.invalidateUsers(usersWithRole.map(u => u.id));
  }

  return true;
}

/**
 * Get users with specific role
 *
 * @param {string} role_id - Role ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Users with pagination
 */
export async function getUsersWithRole(role_id, options, models) {
  const { page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  const { Role, User, UserProfile } = models;

  const { sequelize } = Role;
  const { Op } = sequelize.Sequelize;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Build where clause for search
  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [{ email: { [Op.like]: `%${search}%` } }];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Role,
        as: 'roles',
        where: { id: role_id },
        through: { attributes: [] },
      },
      {
        model: UserProfile,
        as: 'profile',
        attributes: ['first_name', 'last_name', 'display_name'],
      },
    ],
    attributes: ['id', 'email', 'is_active', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[{ model: UserProfile, as: 'profile' }, 'display_name', 'ASC']],
    subQuery: false,
  });

  return {
    role: { id: role.id, name: role.name },
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
 * Get groups with specific role
 *
 * @param {string} role_id - Role ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Groups with pagination
 */
export async function getGroupsWithRole(role_id, options, models) {
  const { page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  const { Role, Group, User } = models;

  const { sequelize } = Role;
  const { Op } = sequelize.Sequelize;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Build where clause for search
  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows: groups } = await Group.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Role,
        as: 'roles',
        where: { id: role_id },
        through: { attributes: [] },
      },
    ],
    attributes: ['id', 'name', 'description', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
    subQuery: false,
  });

  // Fetch user counts for each group
  const groupsWithCounts = await Promise.all(
    groups.map(async group => {
      const userCount = await User.count({
        include: [
          {
            model: Group,
            as: 'groups',
            where: { id: group.id },
            required: true,
          },
        ],
      });

      return {
        ...group.toJSON(),
        userCount,
      };
    }),
  );

  return {
    role: { id: role.id, name: role.name },
    groups: groupsWithCounts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get role statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Role statistics
 */
export async function getRoleStats(models) {
  const { Role, Permission, User, Group } = models;

  const { sequelize } = Role;
  const { fn, col } = sequelize.Sequelize;

  // Get total roles
  const totalRoles = await Role.count();
  const activeRoles = await Role.count({ where: { is_active: true } });
  const inactiveRoles = await Role.count({ where: { is_active: false } });

  // Get roles with most users
  const rolesWithUsers = await Role.findAll({
    attributes: ['id', 'name', [fn('COUNT', col('users.id')), 'userCount']],
    include: [
      {
        model: User,
        as: 'users',
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['Role.id', 'Role.name'],
    order: [[fn('COUNT', col('users.id')), 'DESC']],
    limit: 5,
    subQuery: false,
  });

  // Get roles with most permissions
  const rolesWithPermissions = await Role.findAll({
    attributes: [
      'id',
      'name',
      [fn('COUNT', col('permissions.id')), 'permissionCount'],
    ],
    include: [
      {
        model: Permission,
        as: 'permissions',
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['Role.id', 'Role.name'],
    order: [[fn('COUNT', col('permissions.id')), 'DESC']],
    limit: 5,
    subQuery: false,
  });

  // Get roles with most groups
  const rolesWithGroups = await Role.findAll({
    attributes: ['id', 'name', [fn('COUNT', col('groups.id')), 'groupCount']],
    include: [
      {
        model: Group,
        as: 'groups',
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['Role.id', 'Role.name'],
    order: [[fn('COUNT', col('groups.id')), 'DESC']],
    limit: 5,
    subQuery: false,
  });

  return {
    total: totalRoles,
    active: activeRoles,
    inactive: inactiveRoles,
    topByUsers: rolesWithUsers.map(r => ({
      id: r.id,
      name: r.name,
      count: parseInt(r.get('userCount')) || 0,
    })),
    topByPermissions: rolesWithPermissions.map(r => ({
      id: r.id,
      name: r.name,
      count: parseInt(r.get('permissionCount')) || 0,
    })),
    topByGroups: rolesWithGroups.map(r => ({
      id: r.id,
      name: r.name,
      count: parseInt(r.get('groupCount')) || 0,
    })),
  };
}
