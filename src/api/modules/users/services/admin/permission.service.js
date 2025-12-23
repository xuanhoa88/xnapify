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
 * @param {string} permissionData.name - Auto-generated from resource:action
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

  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Check if resource:action combination is being changed and if it already exists
  const newResource = updateData.resource || permission.resource;
  const newAction = updateData.action || permission.action;
  const newName = `${newResource}:${newAction}`;

  if (newName !== permission.name) {
    const existingPermission = await Permission.findOne({
      where: {
        [Op.and]: [{ resource: newResource }, { action: newAction }],
        id: { [Op.ne]: permission_id },
      },
    });
    if (existingPermission) {
      const error = new Error(`Permission '${newName}' already exists`);
      error.name = 'PermissionAlreadyExistsError';
      error.status = 400;
      throw error;
    }
  }

  // Ensure name is always synced with resource:action
  await permission.update({ ...updateData, name: newName });
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
