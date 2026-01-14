/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ADMIN_ROLE,
  MODERATOR_ROLE,
  DEFAULT_ROLE,
  SYSTEM_ROLES,
  ADMIN_GROUP,
  DEFAULT_GROUP,
  SYSTEM_GROUPS,
  DEFAULT_ACTIONS,
  DEFAULT_RESOURCES,
  SYSTEM_PERMISSIONS,
} from '../../constants/rbac';
import * as rbacCache from '../../utils/rbac/cache';
import { collectUserRBACData } from '../../utils/rbac/collector';
import { logActivity } from '../../utils/activity';

/**
 * Log RBAC activity
 *
 * @param {Object} webhook - Webhook engine
 * @param {string} event - Event name (e.g., 'role_assigned', 'group_assigned')
 * @param {string} entityType - Entity type ('user', 'group', 'role')
 * @param {string} entityId - Entity ID
 * @param {Object} data - Additional data
 * @param {string} [actorId] - Actor performing the action
 */
async function logRbacActivity(
  webhook,
  event,
  entityType,
  entityId,
  data = {},
  actorId,
) {
  await logActivity(webhook, {
    event: `rbac.${event}`,
    entityType,
    entityId,
    action: event,
    data,
    actorId,
  });
}

/**
 * Create default groups
 * Uses bulk operations instead of queries in loops
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created/existing groups
 */
export async function createDefaultGroups(models) {
  const { Group } = models;

  const groupMetadata = {
    [ADMIN_GROUP]: {
      description: 'System administrators with full access to all resources',
      category: 'system',
      type: 'security',
    },
    [DEFAULT_GROUP]: {
      description: 'Standard users with basic access permissions',
      category: 'standard',
      type: 'default',
    },
  };

  // Fetch all existing groups in one query
  const existingGroups = await Group.findAll({
    where: { name: SYSTEM_GROUPS },
  });
  const existingNames = new Set(existingGroups.map(g => g.name));

  // Filter out groups that already exist
  const newGroups = SYSTEM_GROUPS.filter(name => !existingNames.has(name)).map(
    name => ({
      name,
      ...groupMetadata[name],
      is_active: true,
    }),
  );

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
export async function createDefaultPermissions(models) {
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
  const newPerms = SYSTEM_PERMISSIONS.filter(
    p => !existingKeys.has(`${p.resource}:${p.action}`),
  ).map(p => ({
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
    SYSTEM_PERMISSIONS.map(p => `${p.resource}:${p.action}`),
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
export async function createDefaultRoles(models) {
  const { Role } = models;

  const roleMetadata = {
    [ADMIN_ROLE]: {
      description: 'Administrator - Full system access to all resources',
    },
    [DEFAULT_ROLE]: {
      description: 'User - Basic read access to own resources',
    },
    [MODERATOR_ROLE]: {
      description: 'Moderator - Content moderation and review permissions',
    },
  };

  // Fetch all existing roles in one query
  const existingRoles = await Role.findAll({
    where: { name: SYSTEM_ROLES },
  });
  const existingNames = new Set(existingRoles.map(r => r.name));

  // Filter out roles that already exist
  const newRoles = SYSTEM_ROLES.filter(name => !existingNames.has(name)).map(
    name => ({
      name,
      ...roleMetadata[name],
      is_active: true,
    }),
  );

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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Setup result with counts and message
 */
export async function initializeDefault(models) {
  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  try {
    // Step 1: Create default resources
    const permissions = await createDefaultPermissions(models);
    const roles = await createDefaultRoles(models);
    const groups = await createDefaultGroups(models);

    // Step 2: Get role references
    const adminRole = roles.find(r => r.name === ADMIN_ROLE);
    const userRole = roles.find(r => r.name === DEFAULT_ROLE);
    const moderatorRole = roles.find(r => r.name === MODERATOR_ROLE);

    // Step 3: Assign permissions to roles
    if (adminRole) {
      // Admin gets super admin permission (*:*) for full access
      const superAdminPermission = await Permission.findOne({
        where: {
          resource: DEFAULT_RESOURCES.ALL,
          action: DEFAULT_ACTIONS.MANAGE,
        },
      });
      if (superAdminPermission) {
        await adminRole.setPermissions([superAdminPermission]);
      }
    }

    if (userRole) {
      // User gets read-only permissions
      const readPermissions = await Permission.findAll({
        where: { action: DEFAULT_ACTIONS.READ },
      });
      await userRole.setPermissions(readPermissions);
    }

    if (moderatorRole) {
      // Moderator gets read + update on users/groups
      const modPermissions = await Permission.findAll({
        where: {
          [Op.or]: [
            { action: DEFAULT_ACTIONS.READ },
            {
              resource: DEFAULT_RESOURCES.USERS,
              action: DEFAULT_ACTIONS.UPDATE,
            },
            {
              resource: DEFAULT_RESOURCES.GROUPS,
              action: DEFAULT_ACTIONS.UPDATE,
            },
          ],
        },
      });
      await moderatorRole.setPermissions(modPermissions);
    }

    // Step 4: Assign roles to groups
    const adminGroup = groups.find(g => g.name === ADMIN_GROUP);
    const usersGroup = groups.find(g => g.name === DEFAULT_GROUP);

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} User with roles
 */
export async function assignRolesToUser(
  user_id,
  role_names,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'roles_assigned',
    'user',
    user_id,
    { roles: role_names },
    actorId,
  );

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  // Reload user with roles
  await user.reload({
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });
  return user;
}

/**
 * Assign groups to a user
 *
 * @param {string} user_id - User ID
 * @param {string[]} group_ids - Array of group IDs
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} User with groups
 */
export async function assignGroupsToUser(
  user_id,
  group_ids,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'groups_assigned',
    'user',
    user_id,
    { groups: group_ids },
    actorId,
  );

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  // Reload user with groups
  await user.reload({
    include: [
      {
        model: Group,
        as: 'groups',
        through: { attributes: [] },
      },
    ],
  });
  return user;
}

/**
 * Add role to user
 *
 * @param {string} user_id - User ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated user
 */
export async function addRoleToUser(
  user_id,
  role_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'role_added',
    'user',
    user_id,
    { role_id, role_name: role.name },
    actorId,
  );

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated user
 */
export async function removeRoleFromUser(
  user_id,
  role_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'role_removed',
    'user',
    user_id,
    { role_id, role_name: role.name },
    actorId,
  );

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated user
 */
export async function addGroupToUser(
  user_id,
  group_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'group_added',
    'user',
    user_id,
    { group_id, group_name: group.name },
    actorId,
  );

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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated user
 */
export async function removeGroupFromUser(
  user_id,
  group_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'group_removed',
    'user',
    user_id,
    { group_id, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for this user
  rbacCache.invalidateUser(user_id);

  return user;
}

/**
 * Get user's effective permissions (from roles and groups)
 * Uses in-memory cache for performance (5-minute TTL)
 * If user has wildcard (*:manage), expands to all permissions for API response
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @param {Object} [options] - Options
 * @param {boolean} [options.forceRefresh=false] - Force fetch from database
 * @returns {Promise<string[]>} Array of permission strings (e.g., 'users:read')
 */
export async function getUserPermissions(user_id, models, options = {}) {
  const { forceRefresh = false } = options;

  // Check cache first (unless force refresh requested)
  if (!forceRefresh) {
    const cached = rbacCache.getUser(user_id);
    if (cached) {
      // Check for wildcard and expand if needed
      if (
        cached.permissions.includes(
          `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`,
        )
      ) {
        // Expand wildcard to all permissions for API response
        const { Permission } = models;
        const { sequelize } = Permission;
        const { Op } = sequelize.Sequelize;
        const allPermissions = await Permission.findAll({
          where: {
            [Op.not]: {
              [Op.and]: [
                { resource: DEFAULT_RESOURCES.ALL },
                { action: DEFAULT_ACTIONS.MANAGE },
              ],
            },
            is_active: true,
          },
        });
        return allPermissions.map(p => `${p.resource}:${p.action}`);
      }
      return cached.permissions;
    }
  }

  // Fetch from database
  const { User, Role, Permission, Group } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  const user = await User.findByPk(user_id, {
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

  // Use shared RBAC data collector
  const rbacData = collectUserRBACData(user);

  // Cache the result (with wildcards for authorization)
  rbacCache.setUser(user_id, rbacData);

  // Check for wildcard and expand if present
  if (
    rbacData.permissions.includes(
      `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`,
    )
  ) {
    // Expand wildcard to ALL non-wildcard permissions from DB
    const allPermissions = await Permission.findAll({
      where: {
        [Op.not]: {
          [Op.and]: [
            { resource: DEFAULT_RESOURCES.ALL },
            { action: DEFAULT_ACTIONS.MANAGE },
          ],
        },
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });
    return allPermissions.map(p => `${p.resource}:${p.action}`);
  }

  // No wildcard: return user's actual permissions (already filtered in collector)
  return rbacData.permissions;
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
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user has permission
 */
export async function userHasPermission(user_id, permissionName, models) {
  try {
    const userPermissions = await getUserPermissions(user_id, models);

    // Super admin check
    if (
      userPermissions.includes(
        `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`,
      )
    ) {
      return true;
    }

    // Exact match
    if (userPermissions.includes(permissionName)) {
      return true;
    }

    // Parse the requested permission
    const [resource, action] = permissionName.split(':');

    // Resource-only check (e.g., 'users' matches any 'users:*')
    if (!action) {
      return userPermissions.some(perm => perm.startsWith(`${resource}:`));
    }

    // Wildcard action check (e.g., 'users:*' matches 'users:read')
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }
  } catch (error) {
    console.error('Error checking user permission:', error);
  }

  return false;
}

/**
 * Get group's effective permissions (from roles)
 * If any role has wildcard (*:manage), expands to all permissions
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Object containing permissions and roleDetails
 */
export async function getGroupPermissions(group_id, models) {
  const { Group, Role, Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

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

  const permissions = new Set();
  const roleDetails = [];

  // Check if any role has wildcard permission
  let hasWildcardRole = false;

  // Get permissions from each role
  for (const role of group.roles) {
    // Check if this role has the wildcard permission
    const roleHasWildcard = role.permissions.some(
      p =>
        p.resource === DEFAULT_RESOURCES.ALL &&
        p.action === DEFAULT_ACTIONS.MANAGE,
    );

    if (roleHasWildcard) {
      hasWildcardRole = true;
    }

    // Filter out wildcards for non-expanded listing
    const filteredPerms = filterWildcardPermissions(role.permissions);
    const rolePerms = filteredPerms.map(p => `${p.resource}:${p.action}`);
    rolePerms.forEach(p => permissions.add(p));
    roleDetails.push({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: rolePerms,
      hasWildcard: roleHasWildcard,
    });
  }

  // If any role has wildcard, expand to all permissions
  if (hasWildcardRole) {
    const allPermissions = await Permission.findAll({
      where: {
        [Op.not]: {
          [Op.and]: [
            { resource: DEFAULT_RESOURCES.ALL },
            { action: DEFAULT_ACTIONS.MANAGE },
          ],
        },
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });
    allPermissions.forEach(p => permissions.add(`${p.resource}:${p.action}`));

    // Update role details for wildcard roles
    const allPermStrings = allPermissions.map(p => `${p.resource}:${p.action}`);
    roleDetails.forEach(detail => {
      if (detail.hasWildcard) {
        detail.permissions = allPermStrings;
      }
    });
  }

  return {
    permissions: Array.from(permissions).sort(),
    roleDetails,
  };
}

/**
 * Get group's roles with permissions
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group with roles
 */
export async function getGroupRoles(group_id, models) {
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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Group with updated roles
 */
export async function assignRolesToGroup(
  group_id,
  role_names,
  { models, webhook, actorId },
) {
  const { Group, Role, User } = models;

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

  // Log activity
  await logRbacActivity(
    webhook,
    'roles_assigned',
    'group',
    group_id,
    { roles: role_names, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for all users in this group
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    rbacCache.invalidateUsers(groupWithUsers.users.map(u => u.id));
  }

  // Return group with roles
  return await Group.findByPk(group_id, {
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });
}

/**
 * Add role to group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated group
 */
export async function addRoleToGroup(
  group_id,
  role_id,
  { models, webhook, actorId },
) {
  const { Group, Role, User } = models;

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

  // Log activity
  await logRbacActivity(
    webhook,
    'role_added',
    'group',
    group_id,
    { role_id, role_name: role.name, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for all users in this group
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    rbacCache.invalidateUsers(groupWithUsers.users.map(u => u.id));
  }

  return group;
}

/**
 * Remove role from group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated group
 */
export async function removeRoleFromGroup(
  group_id,
  role_id,
  { models, webhook, actorId },
) {
  const { Group, Role, User } = models;

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

  // Log activity
  await logRbacActivity(
    webhook,
    'role_removed',
    'group',
    group_id,
    { role_id, role_name: role.name, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for all users in this group
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    rbacCache.invalidateUsers(groupWithUsers.users.map(u => u.id));
  }

  return group;
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
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated group
 */
export async function addUserToGroup(
  group_id,
  user_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'user_added',
    'group',
    group_id,
    { user_id, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for this user (they now inherit group's roles)
  rbacCache.invalidateUser(user_id);

  return group;
}

/**
 * Remove user from group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} options - Options object
 * @param {Object} options.models - Database models
 * @param {Object} [options.webhook] - Webhook engine for activity logging
 * @param {string} [options.actorId] - ID of admin performing action
 * @returns {Promise<Object>} Updated group
 */
export async function removeUserFromGroup(
  group_id,
  user_id,
  { models, webhook, actorId },
) {
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

  // Log activity
  await logRbacActivity(
    webhook,
    'user_removed',
    'group',
    group_id,
    { user_id, group_name: group.name },
    actorId,
  );

  // Invalidate RBAC cache for this user (they no longer inherit group's roles)
  rbacCache.invalidateUser(user_id);

  return group;
}

// ========================================================================
// ROLE-PERMISSION ASSIGNMENT SERVICES
// ========================================================================

/**
 * Check if a permission is a wildcard (super admin) permission
 * @param {Object} permission - Permission object with resource and action
 * @returns {boolean} True if wildcard permission
 */
function isWildcardPermission(permission) {
  return (
    permission.resource === DEFAULT_RESOURCES.ALL ||
    permission.action === DEFAULT_ACTIONS.MANAGE
  );
}

/**
 * Filter out wildcard permissions from an array
 * @param {Object[]} permissions - Array of permission objects
 * @returns {Object[]} Filtered permissions without wildcards
 */
function filterWildcardPermissions(permissions) {
  return permissions.filter(p => !isWildcardPermission(p));
}

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
  models,
  action,
) {
  const { Role, Permission, User } = models;
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
              { resource: { [Op.ne]: DEFAULT_RESOURCES.ALL } },
              { action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE } },
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
      p.resource === DEFAULT_RESOURCES.ALL ||
      p.action === DEFAULT_ACTIONS.MANAGE,
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
  const usersWithRole = await User.findAll({
    include: [{ model: Role, as: 'roles', where: { id: role.id } }],
    attributes: ['id'],
  });
  if (usersWithRole.length > 0) {
    rbacCache.invalidateUsers(usersWithRole.map(u => u.id));
  }

  // Return role with permissions (excluding wildcards)
  const updatedRole = await Role.findByPk(role.id, {
    include: [
      {
        model: Permission,
        as: 'permissions',
        where: {
          resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
          action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
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
 * If role has wildcard (*:manage), returns ALL active permissions from DB
 *
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of permissions
 */
export async function getRolePermissions(role_id, models) {
  const { Role, Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // First, fetch the role with ALL its permissions (including wildcard)
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

  // Check if role has the wildcard permission (*:manage)
  const hasWildcard = (role.permissions || []).some(
    p =>
      p.resource === DEFAULT_RESOURCES.ALL &&
      p.action === DEFAULT_ACTIONS.MANAGE,
  );

  if (hasWildcard) {
    // Expand wildcard: return ALL non-wildcard permissions from DB
    const allPermissions = await Permission.findAll({
      where: {
        [Op.not]: {
          [Op.and]: [
            { resource: DEFAULT_RESOURCES.ALL },
            { action: DEFAULT_ACTIONS.MANAGE },
          ],
        },
        is_active: true,
      },
      order: [
        ['resource', 'ASC'],
        ['action', 'ASC'],
      ],
    });
    return allPermissions;
  }

  // No wildcard: return role's actual permissions (excluding wildcards)
  return filterWildcardPermissions(role.permissions || []);
}
