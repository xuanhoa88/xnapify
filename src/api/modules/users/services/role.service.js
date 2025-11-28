/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// ROLE MANAGEMENT SERVICES
// ========================================================================

/**
 * Create a new role
 *
 * @param {Object} roleData - Role data
 * @param {string} roleData.name - Role name
 * @param {string} roleData.description - Role description
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Created role
 */
export async function createRole(roleData, models) {
  const { Role } = models;
  const { name, description } = roleData;

  // Check if role already exists
  const existingRole = await Role.findOne({ where: { name } });
  if (existingRole) {
    throw new Error(`Role '${name}' already exists`);
  }

  const role = await Role.create({
    name,
    description,
    is_active: true,
  });

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
  const { Role, Permission } = models;

  const whereCondition = search
    ? {
        [models.Sequelize.Op.or]: [
          { name: { [models.Sequelize.Op.iLike]: `%${search}%` } },
          { description: { [models.Sequelize.Op.iLike]: `%${search}%` } },
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
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
  });

  return {
    roles,
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
    throw new Error('Role not found');
  }

  return role;
}

/**
 * Update role
 *
 * @param {string} role_id - Role ID
 * @param {Object} updateData - Data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated role
 */
export async function updateRole(role_id, updateData, models) {
  const { Role } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    throw new Error('Role not found');
  }

  // Check if name is being changed and if it already exists
  if (updateData.name && updateData.name !== role.name) {
    const existingRole = await Role.findOne({
      where: { name: updateData.name },
    });
    if (existingRole) {
      throw new Error(`Role '${updateData.name}' already exists`);
    }
  }

  await role.update(updateData);
  return role;
}

/**
 * Delete role
 *
 * @param {string} role_id - Role ID
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRole(role_id, models) {
  const { Role } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    throw new Error('Role not found');
  }

  // Prevent deletion of system roles
  const systemRoles = ['admin', 'user', 'moderator'];
  if (systemRoles.includes(role.name)) {
    throw new Error('Cannot delete system roles');
  }

  await role.destroy();
  return true;
}

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
    throw new Error('Role not found');
  }

  // Verify all permissions exist
  const permissions = await Permission.findAll({
    where: { id: permission_ids },
  });

  if (permissions.length !== permission_ids.length) {
    throw new Error('One or more permissions not found');
  }

  // Set permissions for role (replaces existing)
  await role.setPermissions(permissions);

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
    throw new Error('Role not found');
  }

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    throw new Error('Permission not found');
  }

  await role.addPermission(permission);
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
    throw new Error('Role not found');
  }

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    throw new Error('Permission not found');
  }

  await role.removePermission(permission);
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
    throw new Error('Role not found');
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

/**
 * Get users with specific role
 *
 * @param {string} role_id - Role ID
 * @param {Object} options - Query options
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Users with pagination
 */
export async function getUsersWithRole(role_id, options, models) {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;
  const { Role, User } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    throw new Error('Role not found');
  }

  const { count, rows: users } = await User.findAndCountAll({
    include: [
      {
        model: Role,
        as: 'roles',
        where: { id: role_id },
        through: { attributes: [] },
      },
    ],
    attributes: ['id', 'email', 'display_name', 'is_active', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['created_at', 'DESC']],
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
