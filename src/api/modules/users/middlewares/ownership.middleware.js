/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAdmin } from '../constants/rbac';

// ========================================================================
// RESOURCE OWNERSHIP AND ADMIN-BYPASS MIDDLEWARE
// ========================================================================

/**
 * Resource ownership authorization middleware
 *
 * Requires user to own the resource or have admin permissions.
 *
 * @param {string} resource_idParam - Parameter name for resource ID (default: 'id')
 * @param {string} resourceModel - Model name for the resource
 * @param {string} ownerField - Field name that contains the owner ID (default: 'user_id')
 * @returns {Function} Express middleware function
 *
 * @example
 * router.put('/posts/:id', requireOwnership('id', 'Post', 'authorId'), controller.updatePost);
 */
export function requireOwnership(
  resource_idParam = 'id',
  resourceModel,
  ownerField = 'user_id',
) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const Model = models[resourceModel];

      if (!Model) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      const resource_id = req.params[resource_idParam];
      const resource = await Model.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user owns the resource
      const isOwner = resource[ownerField] === req.user.id;

      // Check if user is admin (bypass ownership)
      const isAdminActive = isAdmin(req.user);

      if (!isOwner && !isAdminActive) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.',
        });
      }

      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Ownership check failed',
      });
    }
  };
}

/**
 * Flexible ownership middleware
 *
 * Supports multiple ownership patterns and admin bypass options.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.resource_idParam - Parameter name for resource ID
 * @param {string} options.resourceModel - Model name for the resource
 * @param {string|Function} options.ownerField - Field name or function to determine ownership
 * @param {boolean} options.adminBypass - Whether admins can bypass ownership (default: true)
 * @param {string[]} options.bypassRoles - Roles that can bypass ownership
 * @param {string[]} options.bypassPermissions - Permissions that can bypass ownership
 * @returns {Function} Express middleware function
 *
 * @example
 * router.put('/posts/:id', requireFlexibleOwnership({
 *   resourceModel: 'Post',
 *   ownerField: 'authorId',
 *   bypassRoles: ['admin', 'mod'],
 *   bypassPermissions: ['posts:manage:all']
 * }), controller.updatePost);
 */
export function requireFlexibleOwnership(options) {
  const {
    resource_idParam = 'id',
    resourceModel,
    ownerField = 'user_id',
    adminBypass = true,
    bypassRoles = [],
    bypassPermissions = [],
  } = options;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const Model = models[resourceModel];

      if (!Model) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      const resource_id = req.params[resource_idParam];
      const resource = await Model.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Determine ownership
      let isOwner = false;
      if (typeof ownerField === 'function') {
        isOwner = ownerField(resource, req.user);
      } else {
        isOwner = resource[ownerField] === req.user.id;
      }

      // Check bypass conditions
      let canBypass = false;

      // Admin bypass
      if (adminBypass && isAdmin(req.user)) {
        canBypass = true;
      }

      // Role bypass
      if (bypassRoles.length > 0) {
        if (Array.isArray(req.user.roles)) {
          const userRoleNames = req.user.roles.map(r =>
            typeof r === 'string' ? r : r && r.name,
          );
          if (bypassRoles.some(role => userRoleNames.includes(role))) {
            canBypass = true;
          }
        }
      }

      // Permission bypass (requires cached permissions)
      if (bypassPermissions.length > 0 && req.user.permissions) {
        canBypass = bypassPermissions.some(permission =>
          req.user.permissions.includes(permission),
        );
      }

      if (!isOwner && !canBypass) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.',
        });
      }

      // Attach resource and ownership info to request
      req.resource = resource;
      req.isOwner = isOwner;
      req.bypassedOwnership = !isOwner && canBypass;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Ownership check failed',
      });
    }
  };
}

/**
 * Shared ownership middleware
 *
 * Allows access if user is owner OR has shared access to the resource.
 *
 * @param {string} resource_idParam - Parameter name for resource ID
 * @param {string} resourceModel - Model name for the resource
 * @param {string} ownerField - Field name that contains the owner ID
 * @param {string} sharedModel - Model name for shared access records
 * @param {string} sharedUserField - Field name for user ID in shared model
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/documents/:id', requireSharedOwnership('id', 'Document', 'ownerId', 'DocumentShare', 'user_id'), controller.getDocument);
 */
export function requireSharedOwnership(
  resource_idParam = 'id',
  resourceModel,
  ownerField = 'user_id',
  sharedModel,
  sharedUserField = 'user_id',
) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const Model = models[resourceModel];
      const SharedModel = models[sharedModel];

      if (!Model) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      if (!SharedModel) {
        return res.status(500).json({
          success: false,
          error: `Shared model ${sharedModel} not found`,
        });
      }

      const resource_id = req.params[resource_idParam];
      const resource = await Model.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user owns the resource
      const isOwner = resource[ownerField] === req.user.id;

      let hasSharedAccess = false;
      if (!isOwner) {
        // Check if user has shared access
        const sharedAccess = await SharedModel.findOne({
          where: {
            resource_id: resource_id,
            [sharedUserField]: req.user.id,
          },
        });
        hasSharedAccess = !!sharedAccess;
      }

      if (!isOwner && !hasSharedAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have access to this resource.',
        });
      }

      // Attach resource and access info to request
      req.resource = resource;
      req.isOwner = isOwner;
      req.hasSharedAccess = hasSharedAccess;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Shared ownership check failed',
      });
    }
  };
}

/**
 * Hierarchical ownership middleware
 *
 * Allows access based on hierarchical relationships (e.g., team lead can access team member resources).
 *
 * @param {string} resource_idParam - Parameter name for resource ID
 * @param {string} resourceModel - Model name for the resource
 * @param {string} ownerField - Field name that contains the owner ID
 * @param {Function} hierarchyCheck - Function to check hierarchical relationship
 * @returns {Function} Express middleware function
 *
 * @example
 * const isManager = (resource, user) => user.roles.some(r => r.name === 'manager') && resource.departmentId === user.departmentId;
 * router.get('/reports/:id', requireHierarchicalOwnership('id', 'Report', 'authorId', isManager), controller.getReport);
 */
export function requireHierarchicalOwnership(
  resource_idParam = 'id',
  resourceModel,
  ownerField = 'user_id',
  hierarchyCheck,
) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const Model = models[resourceModel];

      if (!Model) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      const resource_id = req.params[resource_idParam];
      const resource = await Model.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user owns the resource
      const isOwner = resource[ownerField] === req.user.id;

      // Check hierarchical access
      let hasHierarchicalAccess = false;
      if (!isOwner && typeof hierarchyCheck === 'function') {
        hasHierarchicalAccess = await hierarchyCheck(
          resource,
          req.user,
          models,
        );
      }

      if (!isOwner && !hasHierarchicalAccess) {
        return res.status(403).json({
          success: false,
          error:
            'Access denied. You do not have hierarchical access to this resource.',
        });
      }

      // Attach resource and access info to request
      req.resource = resource;
      req.isOwner = isOwner;
      req.hasHierarchicalAccess = hasHierarchicalAccess;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Hierarchical ownership check failed',
      });
    }
  };
}

/**
 * Time-based ownership middleware
 *
 * Allows ownership changes based on time constraints (e.g., can only edit within 1 hour of creation).
 *
 * @param {string} resource_idParam - Parameter name for resource ID
 * @param {string} resourceModel - Model name for the resource
 * @param {string} ownerField - Field name that contains the owner ID
 * @param {number} timeLimit - Time limit in milliseconds
 * @param {string} timeField - Field name for creation/modification time (default: 'created_at')
 * @returns {Function} Express middleware function
 *
 * @example
 * const oneHour = 60 * 60 * 1000;
 * router.put('/comments/:id', requireTimeBasedOwnership('id', 'Comment', 'authorId', oneHour), controller.updateComment);
 */
export function requireTimeBasedOwnership(
  resource_idParam = 'id',
  resourceModel,
  ownerField = 'user_id',
  timeLimit,
  timeField = 'created_at',
) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const Model = models[resourceModel];

      if (!Model) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      const resource_id = req.params[resource_idParam];
      const resource = await Model.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user owns the resource
      const isOwner = resource[ownerField] === req.user.id;

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.',
        });
      }

      // Check time constraint
      const resourceTime = new Date(resource[timeField]);
      const currentTime = new Date();
      const timeDifference = currentTime - resourceTime;

      if (timeDifference > timeLimit) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Time limit for modification has expired.',
        });
      }

      // Attach resource and timing info to request
      req.resource = resource;
      req.isOwner = isOwner;
      req.timeRemaining = timeLimit - timeDifference;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Time-based ownership check failed',
      });
    }
  };
}
