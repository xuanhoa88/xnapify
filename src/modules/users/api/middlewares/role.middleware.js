/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ADMIN_ROLE, SYSTEM_ROLES, MODERATOR_ROLE } from '../constants/rbac';
import { getUserRBACData } from './utils';

// ========================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// ========================================================================

/**
 * Helper: Get user roles from cache or database
 *
 * @param {Object} req - Express request object
 * @returns {Promise<string[]>} User's role names
 */
async function getUserRoles(req) {
  const rbacData = await getUserRBACData(req);
  return rbacData.roles;
}

/**
 * Role-based authorization middleware
 *
 * Requires user to be authenticated and have a specific role.
 * Must be used after authenticate middleware.
 *
 * @param {string} requiredRole - Required role (e.g., 'admin', 'mod')
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/admin', requireRole('admin'), controller.adminAction);
 */
export function requireRole(requiredRole) {
  return async (req, res, next) => {
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userRoles = await getUserRoles(req);

      if (!userRoles.includes(requiredRole)) {
        return http.sendForbidden(
          res,
          `Access denied. Required role: ${requiredRole}`,
        );
      }

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(res, 'Role authorization failed', error);
    }
  };
}

/**
 * Multiple roles authorization middleware
 *
 * Requires user to have ANY of the specified roles.
 *
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/moderation', requireAnyRole(['admin', 'mod']), controller.moderate);
 */
export function requireAnyRole(allowedRoles) {
  return async (req, res, next) => {
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userRoles = await getUserRoles(req);
      const hasRole = userRoles.some(role => allowedRoles.includes(role));

      if (!hasRole) {
        return http.sendForbidden(
          res,
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(res, 'Role authorization failed', error);
    }
  };
}

/**
 * Admin authorization middleware
 *
 * Requires user to be authenticated and have admin role.
 * Must be used after authenticate middleware.
 * This is a convenience function for requireRole('admin').
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * router.get('/admin', requireAdmin, controller.adminAction);
 */
export function requireAdmin(req, res, next) {
  return requireRole(ADMIN_ROLE)(req, res, next);
}

/**
 * Moderator or Admin authorization middleware
 *
 * Requires user to be authenticated and have moderator or admin role.
 * Convenience function for common moderation scenarios.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * router.delete('/posts/:id', requireModerator, controller.deletePost);
 */
export function requireModerator(req, res, next) {
  return requireAnyRole([ADMIN_ROLE, MODERATOR_ROLE])(req, res, next);
}

/**
 * Role hierarchy middleware
 *
 * Checks if user's role meets the minimum required level in a hierarchy.
 * Useful for systems with role hierarchies (e.g., user < mod < admin).
 *
 * @param {string} minimumRole - Minimum required role
 * @param {string[]} roleHierarchy - Array of roles in ascending order of privilege
 * @returns {Function} Express middleware function
 *
 * @example
 * const hierarchy = ['user', 'mod', 'admin'];
 * router.get('/management', requireRoleLevel('mod', hierarchy), controller.manage);
 */
export function requireRoleLevel(minimumRole, roleHierarchy = SYSTEM_ROLES) {
  return async (req, res, next) => {
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const userRoles = await getUserRoles(req);

      const userRoleLevels = userRoles
        .map(role => roleHierarchy.indexOf(role))
        .filter(level => level !== -1);

      const highestUserRoleLevel = Math.max(...userRoleLevels, -1);
      const minimumRoleLevel = roleHierarchy.indexOf(minimumRole);

      // Check if user has any valid role
      if (highestUserRoleLevel === -1) {
        return http.sendForbidden(res, 'Invalid user role');
      }

      if (minimumRoleLevel === -1) {
        const newError = new Error('Invalid minimum role configuration');
        newError.name = 'InvalidRoleConfigurationError';
        throw newError;
      }

      // Check if user's highest role level meets minimum requirement
      if (highestUserRoleLevel < minimumRoleLevel) {
        return http.sendForbidden(
          res,
          `Access denied. Minimum role required: ${minimumRole}`,
        );
      }

      req.user.roleLevel = highestUserRoleLevel;

      next();
    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return http.sendUnauthorized(res, 'User not found');
      }
      return http.sendServerError(
        res,
        'Role level authorization failed',
        error,
      );
    }
  };
}

/**
 * Dynamic role check middleware
 *
 * Allows role requirement to be determined at runtime.
 * Useful for conditional role requirements based on request data.
 *
 * @param {Function} getRoleRequirement - Function that returns required role(s)
 * @returns {Function} Express middleware function
 *
 * @example
 * const dynamicRole = (req) => req.params.type === 'sensitive' ? 'admin' : 'mod';
 * router.get('/data/:type', requireDynamicRole(dynamicRole), controller.getData);
 */
export function requireDynamicRole(getRoleRequirement) {
  return async (req, res, next) => {
    const http = req.app.get('http');

    try {
      const requiredRole = getRoleRequirement(req);

      if (Array.isArray(requiredRole)) {
        return requireAnyRole(requiredRole)(req, res, next);
      } else {
        return requireRole(requiredRole)(req, res, next);
      }
    } catch (error) {
      return http.sendServerError(
        res,
        'Dynamic role authorization failed',
        error,
      );
    }
  };
}
