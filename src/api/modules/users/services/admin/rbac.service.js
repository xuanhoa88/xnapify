/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  invalidateUserCache,
  invalidateUsersCache,
} from '../../utils/rbac-cache';

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
 *
 * @param {string} user_id - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of permissions
 */
export async function getUserPermissions(user_id, models) {
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

  const permissions = new Set();

  // Add permissions from direct roles
  user.roles.forEach(role => {
    role.permissions.forEach(permission => {
      permissions.add(permission.name);
    });
  });

  // Add permissions from group roles
  user.groups.forEach(group => {
    group.roles.forEach(role => {
      role.permissions.forEach(permission => {
        permissions.add(permission.name);
      });
    });
  });

  return Array.from(permissions).sort();
}

/**
 * Check if user has specific permission
 *
 * @param {string} user_id - User ID
 * @param {string} permissionName - Permission name
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if user has permission
 */
export async function userHasPermission(user_id, permissionName, models) {
  const permissions = await getUserPermissions(user_id, models);
  return permissions.includes(permissionName);
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
  return permissionNames.some(permission => permissions.includes(permission));
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
  return permissionNames.every(permission => permissions.includes(permission));
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
      permissions: role.permissions.map(p => p.name),
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
        permissions: role.permissions.map(p => p.name),
      })),
    })),
    effectivePermissions: permissions,
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
  return permissions.some(permission => permission.name === permissionName);
}
