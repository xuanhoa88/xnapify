/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  SYSTEM_ROLES,
  ADMIN_ROLE,
  STAFF_ROLE,
  MODERATOR_ROLE,
} from '../../constants/roles';
import { createDefaultPermissions } from './permission.service';
import { createDefaultGroups } from './group.service';

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
  const { Role, Permission, User } = models;

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
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['name', 'ASC']],
  });

  // Fetch counts for each role
  const rolesWithCounts = await Promise.all(
    roles.map(async role => {
      const [usersCount, permissionsCount] = await Promise.all([
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
        Permission.count({
          include: [
            {
              model: Role,
              as: 'roles',
              where: { id: role.id },
              required: true,
            },
          ],
        }),
      ]);

      return {
        ...role.toJSON(),
        usersCount,
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
    await assignPermissionsToRole(role_id, permissions, models);

    // Reload with permissions
    role.reload();
  }

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
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  // Prevent deletion of system roles
  const systemRoles = SYSTEM_ROLES;
  if (systemRoles.includes(role.name)) {
    const error = new Error('Cannot delete system roles');
    error.name = 'SystemRoleDeletionError';
    error.status = 400;
    throw error;
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
  const { Role, User, UserProfile } = models;

  const role = await Role.findByPk(role_id);
  if (!role) {
    const error = new Error('Role not found');
    error.name = 'RoleNotFoundError';
    error.status = 404;
    throw error;
  }

  const { count, rows: users } = await User.findAndCountAll({
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

// ========================================================================
// RBAC SYSTEM INITIALIZATION
// ========================================================================

/**
 * Initialize default RBAC setup
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Setup result
 */
export async function initializeDefaultRBAC(models) {
  const { Permission } = models;

  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Create default permissions
  const permissions = await createDefaultPermissions(models);

  // Create default roles
  const adminRole = await createRole(
    {
      name: 'admin',
      description: 'System Administrator - Full access',
    },
    models,
  );

  const userRole = await createRole(
    {
      name: 'user',
      description: 'Regular User - Basic access',
    },
    models,
  );

  const moderatorRole = await createRole(
    {
      name: 'moderator',
      description: 'Content Moderator - Limited admin access',
    },
    models,
  );

  // Create default groups
  const groups = await createDefaultGroups(models);

  // Assign all permissions to admin role
  const allPermissions = await Permission.findAll();
  await adminRole.setPermissions(allPermissions);

  // Assign basic permissions to user role
  const basicPermissions = await Permission.findAll({
    where: {
      name: {
        [Op.in]: ['users:read', 'posts:read', 'comments:read', 'files:read'],
      },
    },
  });
  await userRole.setPermissions(basicPermissions);

  // Assign moderation permissions to moderator role
  const moderationPermissions = await Permission.findAll({
    where: {
      name: {
        [Op.in]: [
          'users:read',
          'posts:read',
          'posts:write',
          'comments:read',
          'comments:write',
          'comments:moderate',
          'files:read',
        ],
      },
    },
  });
  await moderatorRole.setPermissions(moderationPermissions);

  // Assign roles to groups
  const adminGroup = groups.find(g => g.name === ADMIN_ROLE);
  const staffGroup = groups.find(g => g.name === STAFF_ROLE);
  const moderatorGroup = groups.find(g => g.name === MODERATOR_ROLE);

  if (adminGroup) {
    await adminGroup.addRole(adminRole);
  }

  if (staffGroup) {
    await staffGroup.addRoles([moderatorRole, userRole]);
  }

  if (moderatorGroup) {
    await moderatorGroup.addRole(moderatorRole);
  }

  return {
    permissions: permissions.length,
    roles: 3,
    groups: groups.length,
    message: 'Default RBAC setup completed successfully',
  };
}
