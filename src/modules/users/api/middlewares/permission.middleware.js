/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ACTIONS, DEFAULT_RESOURCES } from '../constants/rbac';
import { getUserRBACData } from './utils';

// ========================================================================
// PERMISSION-BASED AUTHORIZATION MIDDLEWARES
// ========================================================================

/**
 * Helper: Get user permissions from cache or database
 *
 * @param {Object} req - Express request object
 * @returns {Promise<string[]>} User's permission names
 */
async function getUserPermissions(req) {
  const rbacData = await getUserRBACData(req);
  return rbacData.permissions;
}

/**
 * Helper: Check if user has a specific permission (with wildcard support)
 *
 * Supports wildcard matching:
 * - '*:*' matches all permissions
 * - 'users:*' matches all actions on users resource
 * - '*:read' matches read action on all resources
 *
 * @param {string[]} userPermissions - Array of user's permissions
 * @param {string} requiredPermission - Required permission (e.g., 'users:read')
 * @returns {boolean} True if user has the permission
 */
function hasPermission(userPermissions, requiredPermission) {
  // Invalid user permissions
  if (!Array.isArray(userPermissions)) {
    return false;
  }

  // Direct match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Parse required permission
  const [requiredResource, requiredAction] =
    typeof requiredPermission === 'string' ? requiredPermission.split(':') : [];

  // Invalid required permission format
  if (!requiredResource || !requiredAction) {
    return false;
  }

  // Check wildcard permissions
  return userPermissions.some(userPerm => {
    const [resource, action] =
      typeof userPerm === 'string' ? userPerm.split(':') : [];

    // Invalid user permission format
    if (!resource || !action) {
      return false;
    }

    // Super admin: *:* matches everything
    if (
      resource === DEFAULT_RESOURCES.ALL &&
      action === DEFAULT_ACTIONS.MANAGE
    ) {
      return true;
    }

    // Resource wildcard: users:* matches users:read, users:write, etc.
    if (resource === requiredResource && action === DEFAULT_ACTIONS.MANAGE) {
      return true;
    }

    // Action wildcard: *:read matches users:read, groups:read, etc.
    if (resource === DEFAULT_RESOURCES.ALL && action === requiredAction) {
      return true;
    }

    return false;
  });
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userPermissions = await getUserPermissions(req);

      if (!hasPermission(userPermissions, permission)) {
        return http.sendForbidden(
          res,
          `Access denied. Required permission: ${permission}`,
        );
      }

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(res, 'Permission check failed');
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userPermissions = await getUserPermissions(req);

      // Check if user has all required permissions (with wildcard support)
      const missingPermissions = permissions.filter(
        perm => !hasPermission(userPermissions, perm),
      );

      if (missingPermissions.length > 0) {
        return http.sendForbidden(
          res,
          `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(res, 'Permissions check failed');
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userPermissions = await getUserPermissions(req);

      // Check if user has any of the required permissions (with wildcard support)
      const hasAnyPerm = permissions.some(perm =>
        hasPermission(userPermissions, perm),
      );

      if (!hasAnyPerm) {
        return http.sendForbidden(
          res,
          `Access denied. Required any of: ${permissions.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(res, 'Permission check failed');
    }
  };
}
