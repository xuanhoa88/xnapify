/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  getCachedUserRBAC,
  setCachedUserRBAC,
  collectUserRBACData,
} from '../utils/rbac-cache';

// ========================================================================
// PERMISSION-BASED AUTHORIZATION MIDDLEWARES
// ========================================================================

/**
 * Helper: Get user permissions from cache or database
 *
 * @param {Object} req - Express request object
 * @returns {Promise<string[]>} User's permission names
 */
async function getUserPermissionsWithCache(req) {
  const userId = req.user.id;

  // Check cache first
  const cached = getCachedUserRBAC(userId);
  if (cached) {
    // Attach cached data to request
    req.user = {
      ...req.user,
      roles: cached.roles,
      permissions: cached.permissions,
    };
    return cached.permissions;
  }

  // Get models from app context
  const models = req.app.get('models');
  if (!models) {
    throw new Error('Database models not available');
  }

  const { User, Role, Group, Permission } = models;

  // Fetch from database with full RBAC associations
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        as: 'roles',
        attributes: ['name'],
        through: { attributes: [] },
        include: [
          {
            model: Permission,
            as: 'permissions',
            attributes: ['resource', 'action', 'is_active'],
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
            attributes: ['name'],
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                attributes: ['resource', 'action', 'is_active'],
                through: { attributes: [] },
              },
            ],
          },
        ],
      },
    ],
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Collect and cache RBAC data
  const rbacData = collectUserRBACData(user);
  setCachedUserRBAC(userId, rbacData);

  // Attach to request
  req.user = {
    ...req.user,
    roles: rbacData.roles,
    permissions: rbacData.permissions,
  };

  return rbacData.permissions;
}

/**
 * Permission-based authorization middleware
 *
 * Requires user to have a specific permission.
 * Permissions are checked through user roles.
 *
 * @param {string} permission - Required permission (e.g., 'users:read', 'posts:write')
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/admin/users', requirePermission('users:read'), controller.getUsers);
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const userPermissions = await getUserPermissionsWithCache(req);

      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${permission}`,
        });
      }

      next();
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }
      if (error.message === 'Database models not available') {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
      });
    }
  };
}

/**
 * Multiple permissions authorization middleware
 *
 * Requires user to have ALL specified permissions.
 *
 * @param {string[]} permissions - Array of required permissions
 * @returns {Function} Express middleware function
 *
 * @example
 * router.post('/admin/users', requirePermissions(['users:write', 'users:create']), controller.createUser);
 */
export function requirePermissions(permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const userPermissions = await getUserPermissionsWithCache(req);

      // Check if user has all required permissions
      const missingPermissions = permissions.filter(
        perm => !userPermissions.includes(perm),
      );

      if (missingPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }
      if (error.message === 'Database models not available') {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Permissions check failed',
      });
    }
  };
}

/**
 * Any permission authorization middleware
 *
 * Requires user to have ANY of the specified permissions.
 *
 * @param {string[]} permissions - Array of permissions (user needs at least one)
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/content', requireAnyPermission(['posts:read', 'posts:moderate']), controller.getContent);
 */
export function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const userPermissions = await getUserPermissionsWithCache(req);

      // Check if user has any of the required permissions
      const hasAnyPermission = permissions.some(perm =>
        userPermissions.includes(perm),
      );

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required any of: ${permissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }
      if (error.message === 'Database models not available') {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
      });
    }
  };
}
