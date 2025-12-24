/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// PERMISSION MANAGEMENT SERVICES
// ========================================================================

import {
  DEFAULT_ACTIONS,
  DEFAULT_RESOURCES,
  SYSTEM_PERMISSIONS,
} from '../../constants/rbac';

/**
 * Create a new permission
 *
 * @param {Object} permissionData - Permission data
 * @param {string} permissionData.resource - Resource type (e.g., 'users')
 * @param {string} permissionData.action - Action type (e.g., 'read')
 * @param {string} permissionData.description - Permission description
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Created permission
 */
export async function createPermission(permissionData, models) {
  const { Permission } = models;
  const { resource, action, description, is_active } = permissionData;

  // Check if permission already exists
  const existingPermission = await Permission.findOne({
    where: { resource, action },
  });
  if (existingPermission) {
    const error = new Error(
      `Permission '${resource}:${action}' already exists`,
    );
    error.name = 'PermissionAlreadyExistsError';
    error.status = 400;
    throw error;
  }

  const permission = await Permission.create({
    resource,
    action,
    description,
    is_active: is_active !== undefined ? is_active : true,
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
 * @param {string} options.status - Filter by status: 'active' | 'inactive' | ''
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permissions with pagination
 */
export async function getPermissions(options, models) {
  const {
    page = 1,
    limit = 10,
    search = '',
    resource = '',
    status = '',
  } = options;
  const offset = (page - 1) * limit;

  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  const whereCondition = {
    // Exclude wildcard resource from admin listings
    resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
  };

  // Skip search if it's just the wildcard character
  if (search && search !== DEFAULT_RESOURCES.ALL) {
    whereCondition[Op.or] = [
      {
        resource: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_RESOURCES.ALL },
            { [Op.like]: `%${search}%` },
          ],
        },
      },
      {
        action: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
            { [Op.like]: `%${search}%` },
          ],
        },
      },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  if (resource) {
    // Combine with wildcard exclusion
    whereCondition.resource = {
      [Op.and]: [{ [Op.ne]: DEFAULT_RESOURCES.ALL }, { [Op.eq]: resource }],
    };
  }

  if (status === 'active') {
    whereCondition.is_active = true;
  } else if (status === 'inactive') {
    whereCondition.is_active = false;
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
 * Get unique resources for filter dropdown
 *
 * @param {Object} options - Query parameters
 * @param {string} options.search - Search term
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Object with resources array and pagination
 */
export async function getPermissionResources(options, models) {
  const { search = '', page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Build where condition for search (always exclude wildcard resource)
  const whereCondition = {
    resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
  };
  if (search) {
    whereCondition.resource = {
      [Op.and]: [
        { [Op.ne]: DEFAULT_RESOURCES.ALL },
        { [Op.like]: `%${search}%` },
      ],
    };
  }

  // Get total count of unique resources first
  const countResult = await Permission.count({
    where: whereCondition,
    distinct: true,
    col: 'resource',
  });

  // Get paginated resources using GROUP BY
  const rows = await Permission.findAll({
    attributes: ['resource'],
    where: whereCondition,
    group: ['resource'],
    order: [['resource', 'ASC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    raw: true,
  });

  return {
    resources: rows.map(r => r.resource),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult,
      pages: Math.ceil(countResult / limit),
    },
  };
}

/**
 * Get permissions by resource name
 *
 * @param {string} resource - Resource name
 * @param {Object} options - Query parameters
 * @param {string} options.search - Search term for action
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Object with permissions array and pagination
 */
export async function getPermissionsByResource(resource, options, models) {
  const { search = '', page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Build where condition
  const whereCondition = { resource };
  if (search) {
    whereCondition.action = { [Op.like]: `%${search}%` };
  }

  const { count, rows } = await Permission.findAndCountAll({
    where: whereCondition,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['action', 'ASC']],
  });

  return {
    permissions: rows,
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
  const currentName = `${permission.resource}:${permission.action}`;

  if (newName !== currentName) {
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

  // Update only resource, action, description, is_active
  const updateFields = {};
  if (updateData.resource !== undefined)
    updateFields.resource = updateData.resource;
  if (updateData.action !== undefined) updateFields.action = updateData.action;
  if (updateData.description !== undefined)
    updateFields.description = updateData.description;
  if (updateData.is_active !== undefined)
    updateFields.is_active = updateData.is_active;

  await permission.update(updateFields);
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
  if (
    SYSTEM_PERMISSIONS.some(
      perm =>
        perm.resource === permission.resource &&
        perm.action === permission.action,
    )
  ) {
    const error = new Error('Cannot delete system permissions');
    error.name = 'PermissionSystemError';
    error.status = 400;
    throw error;
  }

  await permission.destroy();
  return permission;
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
        where: { resource: permData.resource, action: permData.action },
      });

      if (!existing) {
        const permission = await Permission.create(permData);
        createdPermissions.push(permission);
      }
    } catch (error) {
      console.warn(
        `Failed to create permission ${permData.resource}:${permData.action}:`,
        error.message,
      );
    }
  }

  return createdPermissions;
}

/**
 * Get permission statistics
 *
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permission statistics
 */
export async function getPermissionStats(models) {
  const { Permission, Role } = models;

  const { sequelize } = Permission;
  const { Op, fn, col } = sequelize.Sequelize;

  // Get total permissions (excluding wildcards)
  const totalPermissions = await Permission.count({
    where: {
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
  });

  const activePermissions = await Permission.count({
    where: {
      is_active: true,
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
  });

  const inactivePermissions = await Permission.count({
    where: {
      is_active: false,
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
  });

  // Get permissions by resource
  const byResource = await Permission.findAll({
    attributes: ['resource', [fn('COUNT', col('resource')), 'count']],
    where: {
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
    group: ['resource'],
    order: [['resource', 'ASC']],
    raw: true,
  });

  // Get permissions by action
  const byAction = await Permission.findAll({
    attributes: ['action', [fn('COUNT', col('action')), 'count']],
    where: {
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
    group: ['action'],
    order: [['action', 'ASC']],
    raw: true,
  });

  // Get permissions used by most roles
  const topByRoles = await Permission.findAll({
    attributes: [
      'id',
      'resource',
      'action',
      [fn('COUNT', col('roles.id')), 'roleCount'],
    ],
    include: [
      {
        model: Role,
        as: 'roles',
        attributes: [],
        through: { attributes: [] },
      },
    ],
    where: {
      resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
      action: { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
    },
    group: ['Permission.id', 'Permission.resource', 'Permission.action'],
    order: [[fn('COUNT', col('roles.id')), 'DESC']],
    limit: 10,
    subQuery: false,
  });

  return {
    total: totalPermissions,
    active: activePermissions,
    inactive: inactivePermissions,
    byResource: byResource.reduce((acc, stat) => {
      acc[stat.resource] = parseInt(stat.count);
      return acc;
    }, {}),
    byAction: byAction.reduce((acc, stat) => {
      acc[stat.action] = parseInt(stat.count);
      return acc;
    }, {}),
    topByRoles: topByRoles.map(p => ({
      id: p.id,
      name: `${p.resource}:${p.action}`,
      count: parseInt(p.get('roleCount')) || 0,
    })),
  };
}
