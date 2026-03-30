/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacCache from '../../../../users/api/utils/rbac/cache';

/**
 * Create default groups
 * Uses bulk operations instead of queries in loops
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created/existing groups
 */
export async function createDefaultGroups(options = {}) {
  const { models, adminGroup, defaultGroup, systemGroups } = options;
  const { Group } = models;

  const groupMetadata = {
    [adminGroup]: {
      description: 'System administrators with full access to all resources',
      category: 'system',
      type: 'security',
    },
    [defaultGroup]: {
      description: 'Standard users with basic access permissions',
      category: 'standard',
      type: 'default',
    },
  };

  // Fetch all existing groups in one query
  const existingGroups = await Group.findAll({
    where: { name: systemGroups },
  });
  const existingNames = new Set(existingGroups.map(g => g.name));

  // Filter out groups that already exist
  const newGroups = systemGroups
    .filter(name => !existingNames.has(name))
    .map(name => ({
      name,
      ...groupMetadata[name],
      is_active: true,
    }));

  // Bulk create new groups
  const createdGroups =
    newGroups.length > 0 ? await Group.bulkCreate(newGroups) : [];

  return [...existingGroups, ...createdGroups];
}

/**
 * Create default system permissions
 * Uses bulk operations for efficiency
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created/existing permissions
 */
export async function createDefaultPermissions(options = {}) {
  const { models, systemPermissions } = options;
  const { Permission } = models;

  // Fetch all existing permissions
  const existingPerms = await Permission.findAll({
    attributes: ['id', 'resource', 'action'],
  });

  // Build Set of existing resource:action keys
  const existingKeys = new Set(
    existingPerms.map(p => `${p.resource}:${p.action}`),
  );

  // Filter out permissions that already exist
  const newPerms = systemPermissions
    .filter(p => !existingKeys.has(`${p.resource}:${p.action}`))
    .map(p => ({
      resource: p.resource,
      action: p.action,
      description: p.description,
      is_active: true,
    }));

  // Bulk create new permissions
  if (newPerms.length > 0) {
    await Permission.bulkCreate(newPerms);
  }

  // Return system permissions only (filtered from all)
  const systemKeys = new Set(
    systemPermissions.map(p => `${p.resource}:${p.action}`),
  );
  return existingPerms.filter(p => systemKeys.has(`${p.resource}:${p.action}`));
}

/**
 * Create default roles for the RBAC system
 * Uses bulk operations instead of queries in loops
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created/existing roles
 */
export async function createDefaultRoles(options = {}) {
  const { models, adminRole, defaultRole, moderatorRole, systemRoles } =
    options;
  const { Role } = models;

  const roleMetadata = {
    [adminRole]: {
      description: 'Administrator - Full system access to all resources',
    },
    [defaultRole]: {
      description: 'User - Basic read access to own resources',
    },
    [moderatorRole]: {
      description: 'Moderator - Content moderation and review permissions',
    },
  };

  // Fetch all existing roles in one query
  const existingRoles = await Role.findAll({
    where: { name: systemRoles },
  });
  const existingNames = new Set(existingRoles.map(r => r.name));

  // Filter out roles that already exist
  const newRoles = systemRoles
    .filter(name => !existingNames.has(name))
    .map(name => ({
      name,
      ...roleMetadata[name],
      is_active: true,
    }));

  // Bulk create new roles
  const createdRoles =
    newRoles.length > 0 ? await Role.bulkCreate(newRoles) : [];

  return [...existingRoles, ...createdRoles];
}

/**
 * Initialize default RBAC configuration
 *
 * Creates default permissions, roles, and groups, then assigns:
 * - Admin role: All permissions
 * - User role: Read-only permissions
 * - Moderator role: Read + user/group update permissions
 *
 * @param {Object} options - Options
 * @param {Object} options.models - Database models
 * @param {string} options.adminRoleName - Admin role name
 * @param {string} options.defaultRoleName - Default role name
 * @param {string} options.moderatorRoleName - Moderator role name
 * @param {string} options.adminGroupName - Admin group name
 * @param {string} options.defaultGroupName - Default group name
 * @param {Object} options.defaultResources - Default resources
 * @param {Object} options.defaultActions - Default actions
 * @returns {Promise<Object>} Setup result with counts and message
 */
export async function initializeDefault(options = {}) {
  const {
    models,
    adminRoleName,
    defaultRoleName,
    moderatorRoleName,
    adminGroupName,
    defaultGroupName,
    defaultResources,
    defaultActions,
  } = options;
  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  try {
    // Step 1: Create default resources
    const permissions = await createDefaultPermissions(options);
    const roles = await createDefaultRoles(options);
    const groups = await createDefaultGroups(options);

    // Step 2: Get role references
    const adminRole = roles.find(r => r.name === adminRoleName);
    const userRole = roles.find(r => r.name === defaultRoleName);
    const moderatorRole = roles.find(r => r.name === moderatorRoleName);

    // Step 3: Assign permissions to roles
    if (adminRole) {
      // Admin gets super admin permission (*:*) for full access
      const superAdminPermission = await Permission.findOne({
        where: {
          resource: defaultResources.ALL,
          action: defaultActions.MANAGE,
        },
      });
      if (superAdminPermission) {
        await adminRole.setPermissions([superAdminPermission]);
      }
    }

    if (userRole) {
      // User gets read-only permissions
      const readPermissions = await Permission.findAll({
        where: { action: defaultActions.READ },
      });
      await userRole.setPermissions(readPermissions);
    }

    if (moderatorRole) {
      // Moderator gets read + update on users/groups
      const modPermissions = await Permission.findAll({
        where: {
          [Op.or]: [
            { action: defaultActions.READ },
            {
              resource: defaultResources.USERS,
              action: defaultActions.UPDATE,
            },
            {
              resource: defaultResources.GROUPS,
              action: defaultActions.UPDATE,
            },
          ],
        },
      });
      await moderatorRole.setPermissions(modPermissions);
    }

    // Step 4: Assign roles to groups
    const adminGroup = groups.find(g => g.name === adminGroupName);
    const usersGroup = groups.find(g => g.name === defaultGroupName);

    if (adminGroup && adminRole) {
      await adminGroup.addRole(adminRole);
    }

    if (usersGroup && userRole) {
      await usersGroup.addRole(userRole);
    }

    return {
      permissions: permissions.length,
      roles: roles.length,
      groups: groups.length,
      message: 'Default RBAC setup completed successfully',
    };
  } catch (error) {
    console.error('[initializeDefault] Failed:', error.message);
    throw error;
  }
}

// ========================================================================
// USER ASSIGNMENT SERVICES
// ========================================================================

/**
 * Assign roles to a user
 *
 * @param {string} user_id - User ID
 * @param {string[]} role_names - Array of role names
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} User with roles
 */
export async function assignRolesToUser(user_id, role_names, { models, hook }) {
  const { User, Role } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all roles exist (skip if empty array)
  if (role_names.length > 0) {
    const roles = await Role.findAll({
      where: { name: role_names },
    });

    if (roles.length !== role_names.length) {
      const error = new Error('One or more roles not found');
      error.name = 'RoleNotFoundError';
      error.status = 404;
      throw error;
    }

    // Set roles for user (replaces existing)
    await user.setRoles(roles.map(role => role.id));
  } else {
    // Clear all roles
    await user.setRoles([]);
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('roles_assigned', {
      user_id,
      role_names,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return {
    id: user.id,
    email: user.email,
    roles: role_names,
    groups: user.groups || [],
  };
}

/**
 * Assign groups to a user
 *
 * @param {string} user_id - User ID
 * @param {string[]} group_ids - Array of group IDs
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} User with groups
 */
export async function assignGroupsToUser(user_id, group_ids, options = {}) {
  const { models, hook } = options;
  const { User, Group } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all groups exist (skip if empty array)
  if (group_ids.length > 0) {
    const groups = await Group.findAll({
      where: { id: group_ids },
    });

    if (groups.length !== group_ids.length) {
      const error = new Error('One or more groups not found');
      error.name = 'GroupNotFoundError';
      error.status = 404;
      throw error;
    }

    // Set groups for user (replaces existing)
    await user.setGroups(groups);
  } else {
    // Clear all groups
    await user.setGroups([]);
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('groups_assigned', {
      user_id,
      group_ids,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return {
    id: user.id,
    email: user.email,
    roles: (Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles.map(r => r.name)
      : [options.defaultRoleName || 'user']
    ).filter(Boolean),
    groups: Array.isArray(user.groups) ? user.groups : [],
  };
}

/**
 * Add role to user
 *
 * @param {string} user_id - User ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated user
 */
export async function addRoleToUser(user_id, role_id, { models, hook }) {
  const { User, Role } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await user.addRole(role);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('role_assigned', {
      user_id,
      role_id,
      role_name: role.name,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return user;
}

/**
 * Remove role from user
 *
 * @param {string} user_id - User ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated user
 */
export async function removeRoleFromUser(user_id, role_id, { models, hook }) {
  const { User, Role } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await user.removeRole(role);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('role_removed', {
      user_id,
      role_id,
      role_name: role.name,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return user;
}

/**
 * Add group to user
 *
 * @param {string} user_id - User ID
 * @param {string} group_id - Group ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated user
 */
export async function addGroupToUser(user_id, group_id, { models, hook }) {
  const { User, Group } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  await user.addGroup(group);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('group_assigned', {
      user_id,
      group_id,
      group_name: group.name,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return user;
}

/**
 * Remove group from user
 *
 * @param {string} user_id - User ID
 * @param {string} group_id - Group ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated user
 */
export async function removeGroupFromUser(user_id, group_id, { models, hook }) {
  const { User, Group } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  await user.removeGroup(group);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('group_removed', {
      user_id,
      group_id,
      group_name: group.name,
    });
  }

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return user;
}

/**
 * Get user's effective permissions (from roles and groups)
 * Uses in-memory cache for performance (5-minute TTL)
 * If user has wildcard (*:*), expands to all permissions for API response
 *
 * @param {string} user_id - User ID
 * @param {Object} [options] - Options
 * @param {Object} [options.models] - Database models
 * @returns {Promise<string[]>} Array of permission strings (e.g., 'users:read')
 */
export async function getUserPermissions(user_id, options = {}) {
  const { models, cache, defaultResources, defaultActions } = options;
  const { User, Role, Group, Permission } = models;

  // 1. Try to get from cache
  const cachedData = rbacCache.getUser(user_id, cache);
  if (cachedData && cachedData.permissions) {
    return cachedData.permissions;
  }

  const isWildcard = p =>
    p.resource === defaultResources.ALL && p.action === defaultActions.MANAGE;

  // 2. Fetch all permissions for the user (from roles and groups)
  const permissions = await Permission.findAll({
    distinct: true,
    where: { is_active: true },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        required: true,
        attributes: ['id', 'name'],
        include: [
          {
            model: User,
            as: 'users',
            through: { attributes: [] },
            where: { id: user_id },
            required: false,
            attributes: [],
          },
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
            required: false,
            attributes: [],
            include: [
              {
                model: User,
                as: 'users',
                through: { attributes: [] },
                where: { id: user_id },
                required: false,
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
    order: [
      ['resource', 'ASC'],
      ['action', 'ASC'],
    ],
  });

  // 3. Check for wildcard permission
  const hasWildcard = permissions.some(isWildcard);

  let result;
  if (hasWildcard) {
    const { Op } = Permission.sequelize.Sequelize;
    // If super admin, fetch ALL active permissions (excluding the wildcard itself)
    const allPermissions = await Permission.findAll({
      where: {
        is_active: true,
        [Op.not]: {
          [Op.and]: [
            { resource: defaultResources.ALL },
            { action: defaultActions.MANAGE },
          ],
        },
      },
      attributes: ['resource', 'action', 'description'],
    });
    result = allPermissions.map(p => ({
      resource: p.resource,
      action: p.action,
      name: `${p.resource}:${p.action}`,
      description: p.description,
    }));
  } else {
    // Regular user, return their specific permissions
    result = permissions.map(p => ({
      resource: p.resource,
      action: p.action,
      name: `${p.resource}:${p.action}`,
      description: p.description,
    }));
  }

  // 4. Update cache
  const existingCache = cachedData || {};
  rbacCache.setUser(
    user_id,
    {
      ...existingCache,
      permissions: result,
    },
    cache,
  );

  return result;
}

/**
 * Check if user has specific permission
 *
 * Supports flexible permission matching:
 * - Exact match: 'users:read' matches 'users:read'
 * - Wildcard action: 'users:*' matches 'users:read', 'users:update', etc.
 * - Super admin: '*:*' matches any permission
 * - Resource-only: checking 'users' matches any 'users:*' permission
 *
 * @param {string} user_id - User ID
 * @param {string} permissionName - Permission name (e.g., 'users', 'users:read')
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} options.cache - Cache instance
 * @returns {Promise<boolean>} True if user has permission
 */
export async function userHasPermission(user_id, permissionName, options = {}) {
  try {
    const { models, cache, defaultResources, defaultActions } = options;
    const userPermissions = await getUserPermissions(user_id, {
      models,
      cache,
      defaultResources,
      defaultActions,
    });

    // Super admin check
    if (
      userPermissions.find(
        p =>
          p.resource === defaultResources.ALL &&
          p.action === defaultActions.MANAGE,
      )
    ) {
      return true;
    }

    // Exact match
    if (userPermissions.find(p => p.name === permissionName)) {
      return true;
    }

    // Parse the requested permission
    const [resource, action] = permissionName.split(':');

    // Resource-only check (e.g., 'users' matches any 'users:*')
    if (!action) {
      return userPermissions.some(perm => perm.resource === resource);
    }

    // Wildcard action check (e.g., 'users:*' matches 'users:read')
    if (
      userPermissions.find(
        p => p.resource === resource && p.action === defaultActions.MANAGE,
      )
    ) {
      return true;
    }
  } catch (error) {
    console.error('Error checking user permission:', error);
  }

  return false;
}

/**
 * Get group's effective permissions (from roles)
 * If any role has wildcard (*:*), expands to all permissions
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Object containing permissions and roleDetails
 */
export async function getGroupPermissions(group_id, options = {}) {
  const { models, defaultResources, defaultActions } = options;
  const { Group, Role, Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  const isWildcard = p =>
    p.resource === defaultResources.ALL && p.action === defaultActions.MANAGE;

  const group = await Group.findByPk(group_id, {
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
  });

  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if any role has wildcard permission
  const hasWildcardRole = group.roles.some(role =>
    role.permissions.some(
      p =>
        p.resource === defaultResources.ALL &&
        p.action === defaultActions.MANAGE,
    ),
  );

  // Build role details
  const roleDetails = group.roles.map(role => {
    const roleHasWildcard = role.permissions.some(
      p =>
        p.resource === defaultResources.ALL &&
        p.action === defaultActions.MANAGE,
    );
    const filteredPerms = role.permissions.filter(p => !isWildcard(p));
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: filteredPerms.map(p => `${p.resource}:${p.action}`),
      hasWildcard: roleHasWildcard,
    };
  });

  // If wildcard, fetch all active permissions (excluding the wildcard itself)
  if (hasWildcardRole) {
    const allPermissions = await Permission.findAll({
      where: {
        [Op.not]: {
          [Op.and]: [
            { resource: options.defaultResources.ALL },
            { action: options.defaultActions.MANAGE },
          ],
        },
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });

    const allPermStrings = allPermissions.map(p => `${p.resource}:${p.action}`);
    roleDetails.forEach(detail => {
      if (detail.hasWildcard) {
        detail.permissions = allPermStrings;
      }
    });

    return { permissions: allPermissions, roleDetails };
  }

  // No wildcard — fetch distinct permissions for this group directly from DB
  const permissions = await Permission.findAll({
    distinct: true,
    where: {
      [Op.not]: {
        [Op.and]: [
          { resource: defaultResources.ALL },
          { action: defaultActions.MANAGE },
        ],
      },
    },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        required: true,
        attributes: [],
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
            where: { id: group_id },
            required: true,
            attributes: [],
          },
        ],
      },
    ],
    order: [
      ['resource', 'ASC'],
      ['action', 'ASC'],
    ],
  });

  return { permissions, roleDetails };
}

/**
 * Get group's roles with permissions
 *
 * @param {string} group_id - Group ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @returns {Promise<Object>} Group with roles
 */
export async function getGroupRoles(group_id, options = {}) {
  const { models } = options;
  const { Group, Role, Permission } = models;

  const group = await Group.findByPk(group_id, {
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
  });

  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
    },
    roles: group.roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(p => ({
        id: p.id,
        name: `${p.resource}:${p.action}`,
      })),
    })),
  };
}

// ========================================================================
// GROUP-ROLE ASSIGNMENT SERVICES
// ========================================================================

/**
 * Assign roles to group
 *
 * @param {string} group_id - Group ID
 * @param {string[]} role_names - Array of role names
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Group with updated roles
 */
export async function assignRolesToGroup(
  group_id,
  role_names,
  { models, hook },
) {
  const { Group, Role, GroupUser } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all roles exist (skip if empty array)
  if (role_names.length > 0) {
    const roles = await Role.findAll({
      where: { name: role_names },
    });

    if (roles.length !== role_names.length) {
      const error = new Error('One or more roles not found');
      error.name = 'RoleNotFoundError';
      error.status = 404;
      throw error;
    }

    // Set roles for group (replaces existing)
    await group.setRoles(roles.map(role => role.id));
  } else {
    // Clear all roles
    await group.setRoles([]);
  }

  // Invalidate RBAC cache for all users in this group
  const groupUsers = await GroupUser.findAll({
    where: { group_id },
    attributes: ['user_id'],
    raw: true,
  });
  if (groupUsers.length > 0) {
    rbacCache.invalidateUsers(groupUsers.map(gu => gu.user_id));
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('group_roles_assigned', {
      group_id,
      group_name: group.name,
      role_names,
    });
  }

  // Reload group with roles
  await group.reload({
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    roles: (Array.isArray(group.roles) && group.roles.length > 0
      ? group.roles.map(r => r.name)
      : []
    ).filter(Boolean),
  };
}

/**
 * Add role to group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated group
 */
export async function addRoleToGroup(group_id, role_id, { models, hook }) {
  const { Group, Role, GroupUser } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.addRole(role);

  // Invalidate RBAC cache for all users in this group
  const groupUsers = await GroupUser.findAll({
    where: { group_id },
    attributes: ['user_id'],
    raw: true,
  });
  if (groupUsers.length > 0) {
    rbacCache.invalidateUsers(groupUsers.map(gu => gu.user_id));
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('group_role_added', {
      group_id,
      group_name: group.name,
      role_id,
      role_name: role.name,
    });
  }

  // Reload group with roles
  await group.reload({
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    roles: (Array.isArray(group.roles) && group.roles.length > 0
      ? group.roles.map(r => r.name)
      : []
    ).filter(Boolean),
  };
}

/**
 * Remove role from group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated group
 */
export async function removeRoleFromGroup(group_id, role_id, { models, hook }) {
  const { Group, Role, GroupUser } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.removeRole(role);

  // Invalidate RBAC cache for all users in this group
  const groupUsers = await GroupUser.findAll({
    where: { group_id },
    attributes: ['user_id'],
    raw: true,
  });
  if (groupUsers.length > 0) {
    rbacCache.invalidateUsers(groupUsers.map(gu => gu.user_id));
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('group_role_removed', {
      group_id,
      group_name: group.name,
      role_id,
      role_name: role.name,
    });
  }

  // Reload group with roles
  await group.reload({
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    roles: (Array.isArray(group.roles) && group.roles.length > 0
      ? group.roles.map(r => r.name)
      : []
    ).filter(Boolean),
  };
}

// ========================================================================
// GROUP-USER ASSIGNMENT SERVICES
// ========================================================================

/**
 * Add user to group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated group
 */
export async function addUserToGroup(group_id, user_id, { models, hook }) {
  const { Group, User } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.addUser(user);

  // Invalidate RBAC cache for this user (they now inherit group's roles)
  rbacCache.invalidateUser(user_id);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('user_added_to_group', {
      group_id,
      group_name: group.name,
      user_id,
      email: user.email,
    });
  }

  return group;
}

/**
 * Remove user from group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models


 * @returns {Promise<Object>} Updated group
 */
export async function removeUserFromGroup(group_id, user_id, { models, hook }) {
  const { Group, User } = models;

  const group = await Group.findByPk(group_id);
  if (!group) {
    const error = new Error('Group not found');
    error.name = 'GroupNotFoundError';
    error.status = 404;
    throw error;
  }

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  await group.removeUser(user);

  // Invalidate RBAC cache for this user (they no longer inherit group's roles)
  rbacCache.invalidateUser(user_id);

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('user_removed_from_group', {
      group_id,
      group_name: group.name,
      user_id,
      email: user.email,
    });
  }

  return group;
}

// ========================================================================
// ROLE-PERMISSION ASSIGNMENT SERVICES
// ========================================================================

/**
 * Manage permissions for a role (add/remove/replace)
 *
 * @param {string} role_name - Role name
 * @param {string[]} permission_names - Array of permission names (format: "resource:action")
 * @param {Object} models - Database models
 * @param {string} action - Action to perform: 'add', 'remove', or 'replace' (default)
 * @returns {Promise<Object>} Role with updated permissions
 */
export async function manageRolePermissions(
  role_name,
  permission_names,
  options = {},
) {
  const { models, action, defaultResources, defaultActions, hook } = options;
  const { Role, Permission, UserRole } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Validate action
  const validActions = ['add', 'remove', 'replace'];
  const normalizedAction = (action || 'replace').toLowerCase();
  if (!validActions.includes(normalizedAction)) {
    const error = new Error(
      `Invalid action: '${action}'. Must be 'add', 'remove', or 'replace'`,
    );
    error.name = 'ValidationError';
    error.status = 400;
    throw error;
  }

  const role = await Role.findOne({
    where: { name: role_name },
    include: [
      {
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      },
    ],
  });
  if (!role) {
    const error = new Error(`Role '${role_name}' not found`);
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Parse permission names into resource:action pairs
  const permissionConditions = permission_names
    .map(name => {
      const [resource, a] = name.split(':');
      if (!resource || !a) return null;
      return { resource, action: a };
    })
    .filter(Boolean);

  // Skip if no valid permissions
  if (permissionConditions.length === 0 && normalizedAction !== 'replace') {
    return role;
  }

  // Find requested permissions (excluding wildcards)
  const requestedPermissions =
    permissionConditions.length > 0
      ? await Permission.findAll({
          where: {
            [Op.and]: [
              { resource: { [Op.ne]: defaultResources.ALL } },
              { action: { [Op.ne]: defaultActions.MANAGE } },
              {
                [Op.or]: permissionConditions.map(
                  ({ resource, action: a }) => ({
                    resource,
                    action: a,
                  }),
                ),
              },
            ],
          },
        })
      : [];

  // Get existing wildcard permissions that should be preserved
  const existingWildcards = role.permissions.filter(
    p =>
      p.resource === defaultResources.ALL || p.action === defaultActions.MANAGE,
  );

  // Apply action
  switch (normalizedAction) {
    case 'add': {
      // Add new permissions to existing
      await role.addPermissions(requestedPermissions);
      break;
    }
    case 'remove': {
      // Remove specified permissions (but never wildcards via API)
      // Wildcards are already filtered out from requestedPermissions
      await role.removePermissions(requestedPermissions);
      break;
    }
    case 'replace':
    default: {
      // Replace regular permissions but preserve any existing wildcards
      // This prevents accidentally removing super admin access
      const newPermissions = [...requestedPermissions, ...existingWildcards];
      await role.setPermissions(newPermissions);
      break;
    }
  }

  // Invalidate cache for all users with this role
  const userRoles = await UserRole.findAll({
    where: { role_id: role.id },
    attributes: ['user_id'],
    raw: true,
  });
  if (userRoles.length > 0) {
    rbacCache.invalidateUsers(userRoles.map(ur => ur.user_id));
  }

  // Emit hook event
  if (hook) {
    await hook('admin:rbac').emit('role_permissions_updated', {
      role_name,
      action: normalizedAction,
      permission_names,
    });
  }

  // Return role with permissions (excluding wildcards)
  const updatedRole = await Role.findByPk(role.id, {
    include: [
      {
        model: Permission,
        as: 'permissions',
        where: {
          resource: { [Op.ne]: defaultResources.ALL },
          action: { [Op.ne]: defaultActions.MANAGE },
        },
        required: false,
        through: { attributes: [] },
      },
    ],
  });

  return updatedRole;
}

/**
 * Get role permissions
 * If role has wildcard (*:*), returns ALL active permissions from DB
 *
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of permissions
 */
export async function getRolePermissions(role_id, options = {}) {
  const { models, defaultResources, defaultActions } = options;
  const { Role, Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  const isWildcard = p =>
    p.resource === defaultResources.ALL && p.action === defaultActions.MANAGE;

  const role = await Role.findByPk(role_id, {
    include: [
      {
        model: Permission,
        as: 'permissions',
        required: false,
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

  const hasWildcard = role.permissions.some(isWildcard);

  if (hasWildcard) {
    return Permission.findAll({
      where: {
        [Op.not]: {
          [Op.and]: [
            { resource: defaultResources.ALL },
            { action: defaultActions.MANAGE },
          ],
        },
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });
  }

  return role.permissions.filter(p => !isWildcard(p));
}
