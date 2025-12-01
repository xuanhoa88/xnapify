/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ADMIN_ROLE,
  SYSTEM_ROLES,
  MODERATOR_ROLE,
  STAFF_ROLE,
} from '../constants/roles';

// ========================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// ========================================================================

/**
 * Role-based authorization middleware
 *
 * Requires user to be authenticated and have a specific role.
 * Must be used after authenticate middleware.
 *
 * @param {string} requiredRole - Required role (e.g., 'admin', 'moderator')
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/admin', requireAuth, requireRole('admin'), controller.adminAction);
 */
export function requireRole(requiredRole) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      // Get models from app context
      const models = req.app.get('models');
      if (!models) {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }

      const { User } = models;

      // Get user with role information
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'email', 'role'],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user has the required role
      if (user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required role: ${requiredRole}`,
        });
      }

      // Attach full user info to request
      req.user = {
        ...req.user,
        role: user.role,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Role authorization failed',
      });
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
 * router.get('/moderation', requireAuth, requireAnyRole(['admin', 'moderator']), controller.moderate);
 */
export function requireAnyRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }

      const { User } = models;

      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'email', 'role'],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user has any of the allowed roles
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        });
      }

      req.user = {
        ...req.user,
        role: user.role,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Role authorization failed',
      });
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
 * router.get('/admin', requireAuth, requireAdmin, controller.adminAction);
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
 * router.delete('/posts/:id', requireAuth, requireModerator, controller.deletePost);
 */
export function requireModerator(req, res, next) {
  return requireAnyRole([ADMIN_ROLE, MODERATOR_ROLE])(req, res, next);
}

/**
 * Staff authorization middleware
 *
 * Requires user to be authenticated and have staff-level access.
 * Includes admin, moderator, and staff roles.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * router.get('/staff/dashboard', requireAuth, requireStaff, controller.staffDashboard);
 */
export function requireStaff(req, res, next) {
  return requireAnyRole(
    SYSTEM_ROLES.filter(r =>
      [ADMIN_ROLE, MODERATOR_ROLE, STAFF_ROLE].includes(r),
    ),
  )(req, res, next);
}

/**
 * Role hierarchy middleware
 *
 * Checks if user's role meets the minimum required level in a hierarchy.
 * Useful for systems with role hierarchies (e.g., user < staff < moderator < admin).
 *
 * @param {string} minimumRole - Minimum required role
 * @param {string[]} roleHierarchy - Array of roles in ascending order of privilege
 * @returns {Function} Express middleware function
 *
 * @example
 * const hierarchy = ['user', 'staff', 'moderator', 'admin'];
 * router.get('/management', requireAuth, requireRoleLevel('staff', hierarchy), controller.manage);
 */
export function requireRoleLevel(minimumRole, roleHierarchy = SYSTEM_ROLES) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }

      const { User } = models;

      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'email', 'role'],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get role levels
      const userRoleLevel = roleHierarchy.indexOf(user.role);
      const minimumRoleLevel = roleHierarchy.indexOf(minimumRole);

      // Check if role exists in hierarchy
      if (userRoleLevel === -1) {
        return res.status(403).json({
          success: false,
          error: 'Invalid user role',
        });
      }

      if (minimumRoleLevel === -1) {
        return res.status(500).json({
          success: false,
          error: 'Invalid minimum role configuration',
        });
      }

      // Check if user's role level meets minimum requirement
      if (userRoleLevel < minimumRoleLevel) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Minimum role required: ${minimumRole}`,
        });
      }

      req.user = {
        ...req.user,
        role: user.role,
        roleLevel: userRoleLevel,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Role level authorization failed',
      });
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
 * const dynamicRole = (req) => req.params.type === 'sensitive' ? 'admin' : 'staff';
 * router.get('/data/:type', requireAuth, requireDynamicRole(dynamicRole), controller.getData);
 */
export function requireDynamicRole(getRoleRequirement) {
  return async (req, res, next) => {
    try {
      const requiredRole = getRoleRequirement(req);

      if (Array.isArray(requiredRole)) {
        return requireAnyRole(requiredRole)(req, res, next);
      } else {
        return requireRole(requiredRole)(req, res, next);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Dynamic role authorization failed',
      });
    }
  };
}
