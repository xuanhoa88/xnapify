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
    is_active: !!is_active,
  });

  return permission;
}

/**
 * Parse search query into resource and action filters
 *
 * Supports patterns:
 * - 'keyword' → search resource, action, description
 * - 'resource:' or 'resource:*' → search resource only
 * - ':action' or '*:action' → search action only
 * - 'resource:action' → search both
 * - Invalid patterns (empty, wildcards only) → null
 *
 * @param {string} q - Search query string
 * @returns {Object|null} Parsed search with type and values, or null if invalid
 */
function parseSearchQuery(q) {
  if (!q) return null;

  const normalized = q.trim();
  if (!normalized || normalized === DEFAULT_RESOURCES.ALL) return null;

  // Check for colon pattern
  const colonIndex = normalized.indexOf(':');
  if (colonIndex === -1) {
    // Simple keyword search
    return { type: 'keyword', value: normalized };
  }

  // Parse resource:action pattern
  const resource = normalized.slice(0, colonIndex).trim();
  const action = normalized.slice(colonIndex + 1).trim();

  // Normalize wildcards to empty string
  const isResourceEmpty = !resource || resource === DEFAULT_RESOURCES.ALL;
  const isActionEmpty = !action || action === DEFAULT_ACTIONS.MANAGE;

  // Invalid: both parts are empty/wildcards
  if (isResourceEmpty && isActionEmpty) return null;

  // Return parsed result
  if (!isResourceEmpty && isActionEmpty) {
    return { type: 'resource', value: resource };
  }
  if (isResourceEmpty && !isActionEmpty) {
    return { type: 'action', value: action };
  }
  return { type: 'both', resource, action };
}

/**
 * Build search where condition based on parsed query
 *
 * @param {Object} parsed - Parsed search query
 * @param {Object} Op - Sequelize operators
 * @returns {Object} Where condition for search
 */
function buildSearchCondition(parsed, Op) {
  if (!parsed) return {};

  switch (parsed.type) {
    case 'keyword':
      return {
        [Op.or]: [
          {
            resource: {
              [Op.and]: [
                { [Op.ne]: DEFAULT_RESOURCES.ALL },
                { [Op.like]: `%${parsed.value}%` },
              ],
            },
          },
          {
            action: {
              [Op.and]: [
                { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
                { [Op.like]: `%${parsed.value}%` },
              ],
            },
          },
          { description: { [Op.like]: `%${parsed.value}%` } },
        ],
      };

    case 'resource':
      return {
        resource: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_RESOURCES.ALL },
            { [Op.like]: `%${parsed.value}%` },
          ],
        },
      };

    case 'action':
      return {
        action: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
            { [Op.like]: `%${parsed.value}%` },
          ],
        },
      };

    case 'both':
      return {
        resource: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_RESOURCES.ALL },
            { [Op.like]: `%${parsed.resource}%` },
          ],
        },
        action: {
          [Op.and]: [
            { [Op.ne]: DEFAULT_ACTIONS.MANAGE },
            { [Op.like]: `%${parsed.action}%` },
          ],
        },
      };

    default:
      return {};
  }
}

/**
 * Get all permissions with pagination by resource
 *
 * Paginates by distinct resources first, then returns all permissions
 * for each resource in the current page. This keeps resource groups together.
 *
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (paginates resources, not permissions)
 * @param {number} options.limit - Resources per page
 * @param {string} options.search - Search term (supports resource:action patterns)
 * @param {string} options.status - Filter by status: 'active' | 'inactive' | ''
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Permissions grouped by resource with pagination
 */
export async function getPermissions(options, models) {
  const { page = 1, limit = 10, search = '', status = '' } = options;
  const offset = (page - 1) * limit;

  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Build where condition
  const baseWhereCondition = {
    resource: { [Op.ne]: DEFAULT_RESOURCES.ALL },
    ...buildSearchCondition(parseSearchQuery(search), Op),
  };

  // Apply status filter
  if (status === 'active') {
    baseWhereCondition.is_active = true;
  } else if (status === 'inactive') {
    baseWhereCondition.is_active = false;
  }

  // Step 1: Get total count of distinct resources
  const totalResources = await Permission.count({
    where: baseWhereCondition,
    distinct: true,
    col: 'resource',
  });

  // Step 2: Get paginated distinct resources
  const resourceRows = await Permission.findAll({
    attributes: ['resource'],
    where: baseWhereCondition,
    group: ['resource'],
    order: [['resource', 'ASC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    raw: true,
  });

  // Step 3: Get ALL permissions for the resources in this page
  const resourcesInPage = resourceRows.map(r => r.resource);
  if (resourcesInPage.length === 0) {
    return {
      permissions: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        pages: 0,
      },
    };
  }

  const permissions = await Permission.findAll({
    where: {
      ...baseWhereCondition,
      resource: { [Op.in]: resourcesInPage },
    },
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
      total: totalResources,
      pages: Math.ceil(totalResources / limit),
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
  if (updateData.is_active != null)
    updateFields.is_active = !!updateData.is_active;

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
 * Bulk update permission status
 *
 * @param {string[]} ids - Array of permission IDs
 * @param {boolean} is_active - New status value
 * @param {Object} models - Database models
 * @returns {Promise<Object[]>} Updated permissions
 */
export async function bulkUpdateStatus(ids, is_active, models) {
  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Update all permissions with the given IDs
  await Permission.update({ is_active }, { where: { id: { [Op.in]: ids } } });

  // Return the updated permissions
  const updatedPermissions = await Permission.findAll({
    where: { id: { [Op.in]: ids } },
  });

  return updatedPermissions;
}

/**
 * Bulk delete permissions
 *
 * @param {string[]} ids - Array of permission IDs to delete
 * @param {Object} models - Database models
 * @returns {Promise<Object>} Result with deleted count and any protected IDs
 */
export async function bulkDelete(ids, models) {
  const { Permission } = models;
  const { sequelize } = Permission;
  const { Op } = sequelize.Sequelize;

  // Find all permissions to delete
  const permissionsToDelete = await Permission.findAll({
    where: { id: { [Op.in]: ids } },
  });

  // Filter out system permissions (cannot be deleted)
  const protectedIds = [];
  const deletablePermissions = permissionsToDelete.filter(permission => {
    const isSystem = SYSTEM_PERMISSIONS.some(
      perm =>
        perm.resource === permission.resource &&
        perm.action === permission.action,
    );
    if (isSystem) {
      protectedIds.push(permission.id);
      return false;
    }
    return true;
  });

  const deletableIds = deletablePermissions.map(p => p.id);

  // Delete the permissions
  if (deletableIds.length > 0) {
    await Permission.destroy({
      where: { id: { [Op.in]: deletableIds } },
    });
  }

  return {
    deleted: deletableIds.length,
    deletedIds: deletableIds,
    protectedIds,
  };
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
