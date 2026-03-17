/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacCache from '../../../../users/api/utils/rbac/cache';

import { manageRolePermissions } from './rbac.service';

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


 * @returns {Promise<Object>} Created role
 */
export async function createRole(roleData, options = {}) {
  const { models, hook } = options;
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
    await manageRolePermissions(
      role.name,
      permissions,
      {
        models,
        defaultResources: options.defaultResources,
        defaultActions: options.defaultActions,
      },
      'replace',
    );

    // Reload with permissions
    role.reload();
  }

  // Emit hook event

  // Emit hook event
  if (hook) {
    await hook('admin:roles').emit('created', { role });
  }

  return role;
}

/**
 * Get all roles with pagination
 *
 * @param {Object} roleQuery - Query options
 * @param {number} roleQuery.page - Page number
 * @param {number} roleQuery.limit - Items per page
 * @param {string} roleQuery.search - Search term
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} Roles with pagination
 */
export async function getRoles(roleQuery = {}, options = {}) {
  const { page = 1, limit = 10, search = '' } = roleQuery;
  const offset = (page - 1) * limit;

  const { models, defaultResources, defaultActions } = options;
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
          { resource: defaultResources.ALL },
          { action: defaultActions.MANAGE },
        ],
      },
    },
  });

  const roleIds = roles.map(r => r.id);

  // Bulk fetch user counts per role
  const userCountsRows = await User.findAll({
    attributes: [
      [sequelize.col('roles.id'), 'roleId'],
      [sequelize.fn('COUNT', sequelize.col('User.id')), 'count'],
    ],
    include: [
      {
        model: Role,
        as: 'roles',
        where: { id: { [Op.in]: roleIds } },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['roles.id'],
    raw: true,
  });
  const userCountsMap = new Map(
    userCountsRows.map(row => [row.roleId, parseInt(row.count, 10)]),
  );

  // Bulk fetch group counts per role
  const groupCountsRows = await Group.findAll({
    attributes: [
      [sequelize.col('roles.id'), 'roleId'],
      [sequelize.fn('COUNT', sequelize.col('Group.id')), 'count'],
    ],
    include: [
      {
        model: Role,
        as: 'roles',
        where: { id: { [Op.in]: roleIds } },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['roles.id'],
    raw: true,
  });
  const groupCountsMap = new Map(
    groupCountsRows.map(row => [row.roleId, parseInt(row.count, 10)]),
  );

  // Fetch counts for each role without N+1 mapping
  const rolesWithCounts = roles.map(role => {
    // Check if role has wildcard permission
    const hasWildcard = role.permissions.some(
      p =>
        p.resource === defaultResources.ALL &&
        p.action === defaultActions.MANAGE,
    );

    const usersCount = userCountsMap.get(role.id) || 0;
    const groupsCount = groupCountsMap.get(role.id) || 0;
    const permissionsCount = hasWildcard
      ? totalPermissionsCount
      : role.permissions.filter(
          p =>
            !(
              p.resource === defaultResources.ALL &&
              p.action === defaultActions.MANAGE
            ),
        ).length;

    return {
      ...role.toJSON(),
      usersCount,
      groupsCount,
      permissionsCount,
    };
  });

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
export async function getRoleById(role_id, options = {}) {
  const { models, defaultResources, defaultActions } = options;
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
  const wildcardPerm = `${defaultResources.ALL}:${defaultActions.MANAGE}`;
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


 * @returns {Promise<Object>} Updated role
 */
export async function updateRole(role_id, updateData, options = {}) {
  const { models, hook } = options;
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
    await manageRolePermissions(
      role.name,
      permissions,
      {
        models,
        defaultResources: options.defaultResources,
        defaultActions: options.defaultActions,
      },
      'replace',
    );

    // Reload with permissions
    role.reload();
  }

  // Emit hook event

  // Emit hook event
  if (hook) {
    await hook('admin:roles').emit('updated', { role });
  }

  return role;
}

/**
 * Delete role
 *
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<boolean>} Success status
 */
export async function deleteRole(role_id, { models, hook, systemRoles }) {
  const { Role, UserRole } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Prevent deletion of system roles
  if (systemRoles.includes(role.name)) {
    const error = new Error('Cannot delete system roles');
    error.name = 'SystemRoleDeletionError';
    error.status = 400;
    throw error;
  }

  // Get all user IDs with this role before deletion for cache invalidation
  // Use UserRole junction table directly for better database performance
  const userRoles = await UserRole.findAll({
    where: { role_id },
    attributes: ['user_id'],
    raw: true,
  });

  const roleName = role.name;
  await role.destroy();

  // Invalidate RBAC cache for affected users
  if (userRoles.length > 0) {
    rbacCache.invalidateUsers(userRoles.map(ur => ur.user_id));
  }

  // Emit hook event

  // Emit hook event
  if (hook) {
    await hook('admin:roles').emit('deleted', {
      role_id,
      name: roleName,
    });
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
        required: false,
      },
    ],
    distinct: true,
    col: 'id',
    attributes: ['id', 'email', 'is_active', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['email', 'ASC']],
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

  const groupIds = groups.map(g => g.id);

  // Bulk fetch user counts per group
  const userCountsRows = await User.findAll({
    attributes: [
      [sequelize.col('groups.id'), 'groupId'],
      [sequelize.fn('COUNT', sequelize.col('User.id')), 'count'],
    ],
    include: [
      {
        model: Group,
        as: 'groups',
        where: { id: { [Op.in]: groupIds } },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ['groups.id'],
    raw: true,
  });
  const userCountsMap = new Map(
    userCountsRows.map(row => [row.groupId, parseInt(row.count, 10)]),
  );

  // Connect counts back to groups
  const groupsWithCounts = groups.map(group => {
    const userCount = userCountsMap.get(group.id) || 0;

    return {
      ...group.toJSON(),
      userCount,
    };
  });

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
