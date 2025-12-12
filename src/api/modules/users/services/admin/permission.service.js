/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// PERMISSION MANAGEMENT SERVICES
// ========================================================================

/**
 * Create a new permission
 *
 * @param {Object} permissionData - Permission data
 * @param {string} permissionData.name - Permission name (e.g., 'users:read')
 * @param {string} permissionData.resource - Resource type (e.g., 'users')
 * @param {string} permissionData.action - Action type (e.g., 'read')
 * @param {string} permissionData.description - Permission description
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Created permission
 */
export async function createPermission(permissionData, models) {
  const { Permission } = models;
  const { name, resource, action, description } = permissionData;

  // Check if permission already exists
  const existingPermission = await Permission.findOne({ where: { name } });
  if (existingPermission) {
    const error = new Error(`Permission '${name}' already exists`);
    error.name = 'PermissionAlreadyExistsError';
    error.status = 400;
    throw error;
  }

  const permission = await Permission.create({
    name,
    resource,
    action,
    description,
  });

  return permission;
}

/**
 * Get all permissions with pagination
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.resource - Filter by resource
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permissions with pagination
 */
export async function getPermissions(options, models) {
  const { page = 1, limit = 10, search = '', resource = '' } = options;
  const offset = (page - 1) * limit;
  const { Permission } = models;

  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  const whereCondition = {};

  if (search) {
    whereCondition[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  if (resource) {
    whereCondition.resource = resource;
  }

  const { count, rows: permissions } = await Permission.findAndCountAll({
    where: whereCondition,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [
      ['resource', 'ASC'],
      ['action', 'ASC'],
    ],
  });

  return {
    permissions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get permission by ID
 *
 * @param {string} permission_id - Permission ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permission
 */
export async function getPermissionById(permission_id, models) {
  const { Permission } = models;

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  return permission;
}

/**
 * Update permission
 *
 * @param {string} permission_id - Permission ID
 * @param {Object} updateData - Data to update
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Updated permission
 */
export async function updatePermission(permission_id, updateData, models) {
  const { Permission } = models;

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  // Check if name is being changed and if it already exists
  if (updateData.name && updateData.name !== permission.name) {
    const existingPermission = await Permission.findOne({
      where: { name: updateData.name },
    });
    if (existingPermission) {
      const error = new Error(`Permission '${updateData.name}' already exists`);
      error.name = 'PermissionAlreadyExistsError';
      error.status = 400;
      throw error;
    }
  }

  await permission.update(updateData);
  return permission;
}

/**
 * Delete permission
 *
 * @param {string} permission_id - Permission ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Deleted permission
 */
export async function deletePermission(permission_id, models) {
  const { Permission } = models;

  const permission = await Permission.findByPk(permission_id);
  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  // Prevent deletion of system permissions
  const systemPermissions = [
    'system:admin',
    'users:read',
    'users:write',
    'roles:read',
    'roles:write',
  ];

  if (systemPermissions.includes(permission.name)) {
    const error = new Error('Cannot delete system permissions');
    error.name = 'PermissionSystemError';
    error.status = 400;
    throw error;
  }

  await permission.destroy();
  return permission;
}

/**
 * Get permissions by resource
 *
 * @param {string} resource - Resource name
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of permissions
 */
export async function getPermissionsByResource(resource, models) {
  const { Permission } = models;

  const permissions = await Permission.findAll({
    where: { resource },
    order: [['action', 'ASC']],
  });

  return permissions;
}

/**
 * Get all unique resources
 *
 * @param {Object} models - Database models
 * @returns {Promise<string[]>} Array of resource names
 */
export async function getResources(models) {
  const { Permission } = models;

  const resources = await Permission.findAll({
    attributes: [
      [
        models.Sequelize.fn('DISTINCT', models.Sequelize.col('resource')),
        'resource',
      ],
    ],
    order: [['resource', 'ASC']],
    raw: true,
  });

  return resources.map(r => r.resource);
}

/**
 * Create default permissions for common resources
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created permissions
 */
export async function createDefaultPermissions(models) {
  const { Permission } = models;

  const defaultPermissions = [
    // User Management
    {
      name: 'users:read',
      resource: 'users',
      action: 'read',
      description: 'View users',
    },
    {
      name: 'users:write',
      resource: 'users',
      action: 'write',
      description: 'Create and update users',
    },
    {
      name: 'users:delete',
      resource: 'users',
      action: 'delete',
      description: 'Delete users',
    },
    {
      name: 'users:manage',
      resource: 'users',
      action: 'manage',
      description: 'Full user management',
    },

    // Role Management
    {
      name: 'roles:read',
      resource: 'roles',
      action: 'read',
      description: 'View roles',
    },
    {
      name: 'roles:write',
      resource: 'roles',
      action: 'write',
      description: 'Create and update roles',
    },
    {
      name: 'roles:delete',
      resource: 'roles',
      action: 'delete',
      description: 'Delete roles',
    },

    // Permission Management
    {
      name: 'permissions:read',
      resource: 'permissions',
      action: 'read',
      description: 'View permissions',
    },
    {
      name: 'permissions:write',
      resource: 'permissions',
      action: 'write',
      description: 'Create and update permissions',
    },

    // Group Management
    {
      name: 'groups:read',
      resource: 'groups',
      action: 'read',
      description: 'View groups',
    },
    {
      name: 'groups:write',
      resource: 'groups',
      action: 'write',
      description: 'Create and update groups',
    },
    {
      name: 'groups:delete',
      resource: 'groups',
      action: 'delete',
      description: 'Delete groups',
    },

    // System Administration
    {
      name: 'system:admin',
      resource: 'system',
      action: 'admin',
      description: 'System administration',
    },
    {
      name: 'system:settings',
      resource: 'system',
      action: 'settings',
      description: 'Manage system settings',
    },

    // Content Management (examples)
    {
      name: 'posts:read',
      resource: 'posts',
      action: 'read',
      description: 'View posts',
    },
    {
      name: 'posts:write',
      resource: 'posts',
      action: 'write',
      description: 'Create and update posts',
    },
    {
      name: 'posts:delete',
      resource: 'posts',
      action: 'delete',
      description: 'Delete posts',
    },
    {
      name: 'posts:publish',
      resource: 'posts',
      action: 'publish',
      description: 'Publish posts',
    },

    // Comments Management (examples)
    {
      name: 'comments:read',
      resource: 'comments',
      action: 'read',
      description: 'View comments',
    },
    {
      name: 'comments:write',
      resource: 'comments',
      action: 'write',
      description: 'Create and update comments',
    },
    {
      name: 'comments:delete',
      resource: 'comments',
      action: 'delete',
      description: 'Delete comments',
    },
    {
      name: 'comments:moderate',
      resource: 'comments',
      action: 'moderate',
      description: 'Moderate comments',
    },

    // File Management (examples)
    {
      name: 'files:read',
      resource: 'files',
      action: 'read',
      description: 'View files',
    },
    {
      name: 'files:write',
      resource: 'files',
      action: 'write',
      description: 'Upload and update files',
    },
    {
      name: 'files:delete',
      resource: 'files',
      action: 'delete',
      description: 'Delete files',
    },

    // Analytics (examples)
    {
      name: 'analytics:read',
      resource: 'analytics',
      action: 'read',
      description: 'View analytics',
    },
    {
      name: 'analytics:export',
      resource: 'analytics',
      action: 'export',
      description: 'Export analytics data',
    },
  ];

  const createdPermissions = [];

  for (const permData of defaultPermissions) {
    try {
      // Check if permission already exists
      const existing = await Permission.findOne({
        where: { name: permData.name },
      });

      if (!existing) {
        const permission = await Permission.create(permData);
        createdPermissions.push(permission);
      }
    } catch (error) {
      // Continue with other permissions if one fails
      console.warn(
        `Failed to create permission ${permData.name}:`,
        error.message,
      );
    }
  }

  return createdPermissions;
}

/**
 * Bulk create permissions
 *
 * @param {Object[]} permissionsData - Array of permission data
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Created permissions
 */
export async function bulkCreatePermissions(permissionsData, models) {
  const { Permission } = models;
  const createdPermissions = [];

  for (const permData of permissionsData) {
    try {
      const existing = await Permission.findOne({
        where: { name: permData.name },
      });

      if (!existing) {
        const permission = await Permission.create(permData);
        createdPermissions.push(permission);
      }
    } catch (error) {
      console.warn(
        `Failed to create permission ${permData.name}:`,
        error.message,
      );
    }
  }

  return createdPermissions;
}

/**
 * Get roles that have specific permission
 *
 * @param {string} permission_id - Permission ID
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Array of roles
 */
export async function getRolesWithPermission(permission_id, models) {
  const { Permission, Role } = models;

  const permission = await Permission.findByPk(permission_id, {
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
      },
    ],
  });

  if (!permission) {
    const error = new Error('Permission not found');
    error.name = 'PermissionNotFoundError';
    error.status = 404;
    throw error;
  }

  return permission.roles;
}

/**
 * Check if permission exists
 *
 * @param {string} permissionName - Permission name
 * @param {Object} models - Database models
 * @returns {Promise<boolean>} True if permission exists
 */
export async function permissionExists(permissionName, models) {
  const { Permission } = models;

  const permission = await Permission.findOne({
    where: { name: permissionName },
  });

  return !!permission;
}

/**
 * Get permission statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permission statistics
 */
export async function getPermissionStats(models) {
  const { Permission } = models;

  const totalPermissions = await Permission.count();

  const resourceStats = await Permission.findAll({
    attributes: [
      'resource',
      [models.Sequelize.fn('COUNT', models.Sequelize.col('resource')), 'count'],
    ],
    group: ['resource'],
    order: [['resource', 'ASC']],
    raw: true,
  });

  const actionStats = await Permission.findAll({
    attributes: [
      'action',
      [models.Sequelize.fn('COUNT', models.Sequelize.col('action')), 'count'],
    ],
    group: ['action'],
    order: [['action', 'ASC']],
    raw: true,
  });

  return {
    total: totalPermissions,
    byResource: resourceStats.reduce((acc, stat) => {
      acc[stat.resource] = parseInt(stat.count);
      return acc;
    }, {}),
    byAction: actionStats.reduce((acc, stat) => {
      acc[stat.action] = parseInt(stat.count);
      return acc;
    }, {}),
  };
}
