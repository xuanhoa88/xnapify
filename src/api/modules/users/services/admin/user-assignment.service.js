/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// USER ASSIGNMENT SERVICES
// ========================================================================

/**
 * Assign roles to a user
 *
 * @param {string} user_id - User ID
 * @param {string[]} role_ids - Array of role IDs
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User with roles
 */
export async function assignRolesToUser(user_id, role_ids, models) {
  const { User, Role } = models;

  const user = await User.findByPk(user_id);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify all roles exist
  const roles = await Role.findAll({
    where: { id: role_ids },
  });

  if (roles.length !== role_ids.length) {
    const error = new Error('One or more roles not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Set roles for user (replaces existing)
  await user.setRoles(roles);

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

  // Verify all groups exist
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
  const { User, Role, Permission } = models;

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
  const { User, Group, Role } = models;

  const user = await User.findByPk(user_id, {
    include: [
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

  // Get effective permissions
  const permissions = await getUserPermissions(user_id, models);

  return {
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
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

/**
 * Bulk assign roles to multiple users
 *
 * @param {string[]} user_ids - Array of user IDs
 * @param {string[]} role_ids - Array of role IDs
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Assignment result
 */
export async function bulkAssignRolesToUsers(user_ids, role_ids, models) {
  const { User, Role } = models;

  // Verify users exist
  const users = await User.findAll({
    where: { id: user_ids },
  });

  if (users.length !== user_ids.length) {
    const error = new Error('One or more users not found');
    error.name = 'UserNotFoundError';
    error.status = 404;
    throw error;
  }

  // Verify roles exist
  const roles = await Role.findAll({
    where: { id: role_ids },
  });

  if (roles.length !== role_ids.length) {
    const error = new Error('One or more roles not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  let assignedCount = 0;

  // Assign roles to each user
  for (const user of users) {
    await user.addRoles(roles);
    assignedCount++;
  }

  return {
    assignedCount,
    user_ids,
    role_ids,
  };
}
