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
import {
  invalidateUserCache,
  invalidateUsersCache,
  getCachedUserRBAC,
  setCachedUserRBAC,
} from '../../utils/rbac-cache';

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
 * Create default permissions for common resources
 * Uses bulk operations instead of queries in loops
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created/existing permissions
 */
export async function createDefaultPermissions(models) {
  const { Permission } = models;

  // Fetch all existing permissions in one query
  const existingPerms = await Permission.findAll({
    where: {
      resource: SYSTEM_PERMISSIONS.map(p => p.resource),
    },
  });

  // Build a Set of existing resource:action keys
  const existingKeys = new Set(
    existingPerms.map(p => `${p.resource}:${p.action}`),
  );

  // Filter out permissions that already exist
  const newPerms = SYSTEM_PERMISSIONS.filter(
    p => !existingKeys.has(`${p.resource}:${p.action}`),
  ).map(metadata => ({
    ...metadata,
    is_active: true,
  }));

  // Bulk create new permissions
  const createdPerms =
    newPerms.length > 0 ? await Permission.bulkCreate(newPerms) : [];

  return [...existingPerms, ...createdPerms];
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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User with roles
 */
export async function assignRolesToUser(user_id, role_names, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User with groups
 */
export async function assignGroupsToUser(user_id, group_ids, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 */
export async function addRoleToUser(user_id, role_id, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

  return user;
}

/**
 * Remove role from user
 *
 * @param {string} user_id - User ID
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 */
export async function removeRoleFromUser(user_id, role_id, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

  return user;
}

/**
 * Add group to user
 *
 * @param {string} user_id - User ID
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 */
export async function addGroupToUser(user_id, group_id, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

  return user;
}

/**
 * Remove group from user
 *
 * @param {string} user_id - User ID
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated user
 */
export async function removeGroupFromUser(user_id, group_id, models) {
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

  // Invalidate RBAC cache for this user
  invalidateUserCache(user_id);

  return user;
}

/**
 * Get user's effective permissions (from roles and groups)
 * Uses in-memory cache for performance (5-minute TTL)
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
    const cached = getCachedUserRBAC(user_id);
    if (cached) {
      return cached.permissions;
    }
  }

  // Fetch from database
  const { User, Role, Permission, Group } = models;

  const user = await User.findByPk(user_id, {
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

  // Collect permissions and roles
  const permissions = new Set();
  const roles = new Set();
  const groups = [];

  // Add from direct roles
  user.roles.forEach(role => {
    roles.add(role.name);
    role.permissions.forEach(permission => {
      if (permission.is_active !== false) {
        permissions.add(`${permission.resource}:${permission.action}`);
      }
    });
  });

  // Add from group roles
  user.groups.forEach(group => {
    groups.push({ id: group.id, name: group.name });
    group.roles.forEach(role => {
      roles.add(role.name);
      role.permissions.forEach(permission => {
        if (permission.is_active !== false) {
          permissions.add(`${permission.resource}:${permission.action}`);
        }
      });
    });
  });

  const permissionList = Array.from(permissions).sort();

  // Cache the result
  setCachedUserRBAC(user_id, {
    roles: Array.from(roles),
    permissions: permissionList,
    groups,
  });

  return permissionList;
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
  const permissions = await getUserPermissions(user_id, models);
  return matchesPermission(permissions, permissionName);
}

/**
 * Helper function to check if a permission matches with wildcard support
 *
 * @param {string[]} userPermissions - Array of user's permissions
 * @param {string} permissionName - Permission to check
 * @returns {boolean} True if matches
 */
function matchesPermission(userPermissions, permissionName) {
  // Super admin check
  if (userPermissions.includes('*:*')) {
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

  return false;
}

/**
 * Check if user has any of the specified permissions
 *
 * @param {string} user_id - User ID
 * @param {string[]} permissionNames - Array of permission names
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user has any permission
 */
export async function userHasAnyPermission(user_id, permissionNames, models) {
  const permissions = await getUserPermissions(user_id, models);
  return permissionNames.some(permName =>
    matchesPermission(permissions, permName),
  );
}

/**
 * Check if user has all specified permissions
 *
 * @param {string} user_id - User ID
 * @param {string[]} permissionNames - Array of permission names
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user has all permissions
 */
export async function userHasAllPermissions(user_id, permissionNames, models) {
  const permissions = await getUserPermissions(user_id, models);
  return permissionNames.every(permName =>
    matchesPermission(permissions, permName),
  );
}

/**
 * Get user's roles
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of roles
 */
export async function getUserRoles(user_id, models) {
  const { User, Role, Permission, UserProfile } = models;

  const user = await User.findByPk(user_id, {
    include: [
      { model: UserProfile, as: 'profile' },
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

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  return user.roles;
}

/**
 * Get user's groups
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of groups
 */
export async function getUserGroups(user_id, models) {
  const { User, Group, Role, UserProfile } = models;

  const user = await User.findByPk(user_id, {
    include: [
      { model: UserProfile, as: 'profile' },
      {
        model: Group,
        as: 'groups',
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
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

  return user.groups;
}

/**
 * Check if user has specific role
 *
 * @param {string} user_id - User ID
 * @param {string} roleName - Role name
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user has role
 */
export async function userHasRole(user_id, roleName, models) {
  const roles = await getUserRoles(user_id, models);
  return roles.some(role => role.name === roleName);
}

/**
 * Check if user is in specific group
 *
 * @param {string} user_id - User ID
 * @param {string} groupName - Group name
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user is in group
 */
export async function userInGroup(user_id, groupName, models) {
  const groups = await getUserGroups(user_id, models);
  return groups.some(group => group.name === groupName);
}

/**
 * Get user's complete RBAC profile
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Complete RBAC profile
 */
export async function getUserRBACProfile(user_id, models) {
  const { User, Role, Permission, Group, UserProfile } = models;

  const user = await User.findByPk(user_id, {
    include: [
      {
        model: UserProfile,
        as: 'profile',
        attributes: ['first_name', 'last_name', 'display_name'],
      },
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

  // Get effective permissions
  const permissions = await getUserPermissions(user_id, models);

  return {
    user: {
      id: user.id,
      email: user.email,
      display_name: (user.profile && user.profile.display_name) || null,
      is_active: user.is_active,
    },
    roles: user.roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(p => `${p.resource}:${p.action}`),
    })),
    groups: user.groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      type: group.type,
      roles: group.roles.map(role => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions.map(p => `${p.resource}:${p.action}`),
      })),
    })),
    effectivePermissions: permissions,
  };
}

/**
 * Get group's effective permissions (from roles)
 *
 * @param {string} group_id - Group ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Object containing permissions and roleDetails
 */
export async function getGroupPermissions(group_id, models) {
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

  const permissions = new Set();
  const roleDetails = [];

  // Get permissions from each role
  group.roles.forEach(role => {
    const rolePerms = role.permissions.map(p => `${p.resource}:${p.action}`);
    rolePerms.forEach(p => permissions.add(p));
    roleDetails.push({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: rolePerms,
    });
  });

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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Group with updated roles
 */
export async function assignRolesToGroup(group_id, role_names, models) {
  const { Group, Role } = models;

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

    // Set roles for user (replaces existing)
    await group.setRoles(roles.map(role => role.id));
  } else {
    // Clear all roles
    await group.setRoles([]);
  }

  // Invalidate RBAC cache for all users in this group
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: models.User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    invalidateUsersCache(groupWithUsers.users.map(u => u.id));
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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function addRoleToGroup(group_id, role_id, models) {
  const { Group, Role } = models;

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
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: models.User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    invalidateUsersCache(groupWithUsers.users.map(u => u.id));
  }

  return group;
}

/**
 * Remove role from group
 *
 * @param {string} group_id - Group ID
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function removeRoleFromGroup(group_id, role_id, models) {
  const { Group, Role } = models;

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
  const groupWithUsers = await Group.findByPk(group_id, {
    include: [{ model: models.User, as: 'users', attributes: ['id'] }],
  });
  if (
    groupWithUsers &&
    groupWithUsers.users &&
    groupWithUsers.users.length > 0
  ) {
    invalidateUsersCache(groupWithUsers.users.map(u => u.id));
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
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function addUserToGroup(group_id, user_id, models) {
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
  invalidateUserCache(user_id);

  return group;
}

/**
 * Remove user from group
 *
 * @param {string} group_id - Group ID
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated group
 */
export async function removeUserFromGroup(group_id, user_id, models) {
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
  invalidateUserCache(user_id);

  return group;
}

// ========================================================================
// ROLE-PERMISSION ASSIGNMENT SERVICES
// ========================================================================

/**
 * Assign permissions to a role
 *
 * @param {string} role_id - Role ID
 * @param {string[]} permission_ids - Array of permission IDs
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Role with updated permissions
 */
export async function assignPermissionsToRole(role_id, permission_ids, models) {
  const { Role, Permission } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all permissions exist
  const permissions = await Permission.findAll({
    where: { id: permission_ids },
  });

  if (permissions.length !== permission_ids.length) {
    const error = new Error('One or more permissions not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  // Set permissions for role (replaces existing)
  await role.setPermissions(permissions);

  // Invalidate cache for all users with this role
  const usersWithRole = await models.User.findAll({
    include: [{ model: Role, as: 'roles', where: { id: role_id } }],
    attributes: ['id'],
  });
  if (usersWithRole.length > 0) {
    invalidateUsersCache(usersWithRole.map(u => u.id));
  }

  // Return role with permissions
  return await Role.findByPk(role_id, {
    include: [
      {
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      },
    ],
  });
}

/**
 * Add permission to role
 *
 * @param {string} role_id - Role ID
 * @param {string} permission_id - Permission ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated role
 */
export async function addPermissionToRole(role_id, permission_id, models) {
  const { Role, Permission } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  await role.addPermission(permission);

  // Invalidate cache for all users with this role
  const usersWithRole = await models.User.findAll({
    include: [{ model: Role, as: 'roles', where: { id: role_id } }],
    attributes: ['id'],
  });
  if (usersWithRole.length > 0) {
    invalidateUsersCache(usersWithRole.map(u => u.id));
  }

  return role;
}

/**
 * Remove permission from role
 *
 * @param {string} role_id - Role ID
 * @param {string} permission_id - Permission ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated role
 */
export async function removePermissionFromRole(role_id, permission_id, models) {
  const { Role, Permission } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  await role.removePermission(permission);

  // Invalidate cache for all users with this role
  const usersWithRole = await models.User.findAll({
    include: [{ model: Role, as: 'roles', where: { id: role_id } }],
    attributes: ['id'],
  });
  if (usersWithRole.length > 0) {
    invalidateUsersCache(usersWithRole.map(u => u.id));
  }

  return role;
}

/**
 * Get role permissions
 *
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of permissions
 */
export async function getRolePermissions(role_id, models) {
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

  return role.permissions;
}

/**
 * Check if role has permission
 *
 * @param {string} role_id - Role ID
 * @param {string} permissionName - Permission name
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if role has permission
 */
export async function roleHasPermission(role_id, permissionName, models) {
  const permissions = await getRolePermissions(role_id, models);
  return permissions.some(
    permission =>
      `${permission.resource}:${permission.action}` === permissionName,
  );
}
