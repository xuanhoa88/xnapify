/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { userRbacService } from '../services';
import { SYSTEM_ROLES } from '../constants/roles';

// ========================================================================
// SYSTEM MANAGEMENT CONTROLLERS
// ========================================================================

/**
 * Initialize complete RBAC system
 *
 * @route   POST /api/users/rbac/initialize
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function initializeRBAC(req, res) {
  const http = req.app.get('http');
  try {
    // Get models from app context
    const models = req.app.get('models');

    // Initialize RBAC
    const result = await userRbacService.initializeDefaultRBAC(models);

    return http.sendSuccess(res, {
      message: 'RBAC system initialized successfully',
      ...result,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to initialize RBAC system');
  }
}

/**
 * Get RBAC system status
 *
 * @route   GET /api/users/rbac/status
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRBACStatus(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const { Role, Permission, Group, User } = models;

    // Get counts of each entity
    const [roleCount, permissionCount, groupCount, userCount] =
      await Promise.all([
        Role.count(),
        Permission.count(),
        Group.count(),
        User.count(),
      ]);

    // Get system roles
    const systemRoles = await Role.findAll({
      where: {
        name: SYSTEM_ROLES,
      },
      attributes: ['id', 'name', 'description'],
    });

    // Get system permissions
    const systemPermissions = await Permission.findAll({
      where: {
        name: [
          'system:admin',
          'users:read',
          'users:write',
          'roles:read',
          'roles:write',
        ],
      },
      attributes: ['id', 'name', 'resource', 'action'],
    });

    return http.sendSuccess(res, {
      status: 'operational',
      counts: {
        roles: roleCount,
        permissions: permissionCount,
        groups: groupCount,
        users: userCount,
      },
      systemRoles,
      systemPermissions,
      initialized: roleCount > 0 && permissionCount > 0,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to get RBAC status');
  }
}

/**
 * Reset RBAC system (dangerous operation)
 *
 * @route   POST /api/users/rbac/reset
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function resetRBAC(req, res) {
  const http = req.app.get('http');
  try {
    const { confirm } = req.body;

    // Require explicit confirmation
    if (confirm !== 'RESET_RBAC_SYSTEM') {
      return http.sendValidationError(res, {
        confirm: 'Must provide exact confirmation string: RESET_RBAC_SYSTEM',
      });
    }

    const models = req.app.get('models');
    const {
      Role,
      Permission,
      Group,
      UserRole,
      RolePermission,
      UserGroup,
      GroupRole,
    } = models;

    // Clear all RBAC relationships (in order to avoid foreign key constraints)
    await UserRole.destroy({ where: {} });
    await RolePermission.destroy({ where: {} });
    await UserGroup.destroy({ where: {} });
    await GroupRole.destroy({ where: {} });

    // Clear all RBAC entities
    await Role.destroy({ where: {} });
    await Permission.destroy({ where: {} });
    await Group.destroy({ where: {} });

    return http.sendSuccess(res, {
      message: 'RBAC system reset successfully',
      warning: 'All roles, permissions, and groups have been deleted',
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to reset RBAC system');
  }
}

/**
 * Export RBAC configuration
 *
 * @route   GET /api/users/rbac/export
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function exportRBACConfig(req, res) {
  const http = req.app.get('http');
  try {
    const models = req.app.get('models');
    const { Role, Permission, Group } = models;

    // Get all roles with their permissions
    const roles = await Role.findAll({
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
    });

    // Get all groups with their roles
    const groups = await Group.findAll({
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
        },
      ],
    });

    // Get all permissions
    const permissions = await Permission.findAll();

    const config = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      permissions: permissions.map(p => ({
        name: p.name,
        resource: p.resource,
        action: p.action,
        description: p.description,
      })),
      roles: roles.map(r => ({
        name: r.name,
        description: r.description,
        permissions: r.permissions.map(p => p.name),
      })),
      groups: groups.map(g => ({
        name: g.name,
        description: g.description,
        roles: g.roles.map(r => r.name),
      })),
    };

    return http.sendSuccess(res, { config });
  } catch (error) {
    return http.sendServerError(res, 'Failed to export RBAC configuration');
  }
}

/**
 * Import RBAC configuration
 *
 * @route   POST /api/users/rbac/import
 * @access  Admin (requires 'system:admin' permission)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function importRBACConfig(req, res) {
  const http = req.app.get('http');
  try {
    const { config, overwrite = false } = req.body;

    if (!config || !config.permissions || !config.roles) {
      return http.sendValidationError(res, {
        config: 'Invalid configuration format',
      });
    }

    const models = req.app.get('models');
    const { Role, Permission, Group } = models;

    const results = {
      permissions: { created: 0, skipped: 0 },
      roles: { created: 0, skipped: 0 },
      groups: { created: 0, skipped: 0 },
    };

    // Import permissions
    for (const permData of config.permissions) {
      try {
        const existing = await Permission.findOne({
          where: { name: permData.name },
        });
        if (existing && !overwrite) {
          results.permissions.skipped++;
          continue;
        }

        if (existing && overwrite) {
          await existing.update(permData);
        } else {
          await Permission.create(permData);
          results.permissions.created++;
        }
      } catch (error) {
        console.warn(
          `Failed to import permission ${permData.name}:`,
          error.message,
        );
      }
    }

    // Import roles
    for (const roleData of config.roles) {
      try {
        const existing = await Role.findOne({ where: { name: roleData.name } });
        if (existing && !overwrite) {
          results.roles.skipped++;
          continue;
        }

        let role;
        if (existing && overwrite) {
          await existing.update({
            name: roleData.name,
            description: roleData.description,
          });
          role = existing;
        } else {
          role = await Role.create({
            name: roleData.name,
            description: roleData.description,
          });
          results.roles.created++;
        }

        // Assign permissions to role
        if (roleData.permissions && roleData.permissions.length > 0) {
          const permissions = await Permission.findAll({
            where: { name: roleData.permissions },
          });
          await role.setPermissions(permissions);
        }
      } catch (error) {
        console.warn(`Failed to import role ${roleData.name}:`, error.message);
      }
    }

    // Import groups
    if (config.groups) {
      for (const groupData of config.groups) {
        try {
          const existing = await Group.findOne({
            where: { name: groupData.name },
          });
          if (existing && !overwrite) {
            results.groups.skipped++;
            continue;
          }

          let group;
          if (existing && overwrite) {
            await existing.update({
              name: groupData.name,
              description: groupData.description,
            });
            group = existing;
          } else {
            group = await Group.create({
              name: groupData.name,
              description: groupData.description,
            });
            results.groups.created++;
          }

          // Assign roles to group
          if (groupData.roles && groupData.roles.length > 0) {
            const roles = await Role.findAll({
              where: { name: groupData.roles },
            });
            await group.setRoles(roles);
          }
        } catch (error) {
          console.warn(
            `Failed to import group ${groupData.name}:`,
            error.message,
          );
        }
      }
    }

    return http.sendSuccess(res, {
      message: 'RBAC configuration imported successfully',
      results,
    });
  } catch (error) {
    return http.sendServerError(res, 'Failed to import RBAC configuration');
  }
}
