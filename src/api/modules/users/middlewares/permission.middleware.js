/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// PERMISSION-BASED AUTHORIZATION MIDDLEWARES
// ========================================================================

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
 * router.get('/admin/users', requireAuth, requirePermission('users:read'), controller.getUsers);
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
      // Get models from app context
      const models = req.app.get('models');
      if (!models) {
        return res.status(500).json({
          success: false,
          error: 'Database models not available',
        });
      }

      const { User, Role, Permission } = models;

      // Get user with roles and permissions
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
              },
            ],
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user has the required permission
      const hasPermission = user.roles.some(role =>
        role.permissions.some(perm => perm.name === permission),
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${permission}`,
        });
      }

      next();
    } catch (error) {
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
 * router.post('/admin/users', requireAuth, requirePermissions(['users:write', 'users:create']), controller.createUser);
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
      const models = req.app.get('models');
      const { User, Role, Permission } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
              },
            ],
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get all user permissions
      const userPermissions = user.roles.reduce((perms, role) => {
        role.permissions.forEach(perm => perms.add(perm.name));
        return perms;
      }, new Set());

      // Check if user has all required permissions
      const missingPermissions = permissions.filter(
        perm => !userPermissions.has(perm),
      );

      if (missingPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
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
 * router.get('/content', requireAuth, requireAnyPermission(['posts:read', 'posts:moderate']), controller.getContent);
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
      const models = req.app.get('models');
      const { User, Role, Permission } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
              },
            ],
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user has any of the required permissions
      const hasAnyPermission = user.roles.some(role =>
        role.permissions.some(perm => permissions.includes(perm.name)),
      );

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required any of: ${permissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
      });
    }
  };
}

/**
 * Resource-specific permission middleware
 *
 * Checks permissions with resource context (e.g., 'posts:read:own' vs 'posts:read:all').
 *
 * @param {string} resource - Resource type (e.g., 'posts', 'users')
 * @param {string} action - Action type (e.g., 'read', 'write', 'delete')
 * @param {string} scope - Permission scope ('own', 'all', 'team') - optional
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/posts', requireAuth, requireResourcePermission('posts', 'read'), controller.getPosts);
 * router.put('/posts/:id', requireAuth, requireResourcePermission('posts', 'write', 'own'), controller.updatePost);
 */
export function requireResourcePermission(resource, action, scope = null) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const { User, Role, Permission } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
                where: {
                  resource: resource,
                  action: action,
                },
                required: false,
              },
            ],
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Build permission patterns to check
      const permissionPatterns = [
        `${resource}:${action}`, // Basic permission
      ];

      if (scope) {
        permissionPatterns.push(`${resource}:${action}:${scope}`); // Scoped permission
      }

      // Check if user has any matching permission
      const hasPermission = user.roles.some(role =>
        role.permissions.some(
          perm =>
            permissionPatterns.includes(perm.name) ||
            perm.name === `${resource}:*` || // Wildcard action
            perm.name === '*:*', // Super admin permission
        ),
      );

      if (!hasPermission) {
        const requiredPermission = scope
          ? `${resource}:${action}:${scope}`
          : `${resource}:${action}`;

        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${requiredPermission}`,
        });
      }

      // Attach permission context to request
      req.permissionContext = {
        resource,
        action,
        scope,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Resource permission check failed',
      });
    }
  };
}

/**
 * Conditional permission middleware
 *
 * Applies different permission requirements based on request conditions.
 *
 * @param {Function} getPermissionRequirement - Function that returns permission requirement
 * @returns {Function} Express middleware function
 *
 * @example
 * const getPermission = (req) => req.body.public ? 'posts:create:public' : 'posts:create:private';
 * router.post('/posts', requireAuth, requireConditionalPermission(getPermission), controller.createPost);
 */
export function requireConditionalPermission(getPermissionRequirement) {
  return async (req, res, next) => {
    try {
      const permissionRequirement = getPermissionRequirement(req);

      if (Array.isArray(permissionRequirement)) {
        // Multiple permissions required
        if (permissionRequirement.every(p => typeof p === 'string')) {
          // All permissions required
          return requirePermissions(permissionRequirement)(req, res, next);
        }
        // Any permission required
        return requireAnyPermission(permissionRequirement)(req, res, next);
      }
      if (typeof permissionRequirement === 'string') {
        // Single permission required
        return requirePermission(permissionRequirement)(req, res, next);
      }
      if (permissionRequirement && typeof permissionRequirement === 'object') {
        // Resource permission required
        const { resource, action, scope } = permissionRequirement;
        return requireResourcePermission(resource, action, scope)(
          req,
          res,
          next,
        );
      }
      // No permission required
      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Conditional permission check failed',
      });
    }
  };
}

/**
 * Permission caching middleware
 *
 * Caches user permissions for the duration of the request to avoid repeated database queries.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function cacheUserPermissions(req, res, next) {
  if (!req.user) {
    return next();
  }

  // Skip if permissions already cached
  if (req.user.permissions) {
    return next();
  }

  const models = req.app.get('models');
  if (!models) {
    return next();
  }

  const { User, Role, Permission } = models;

  User.findByPk(req.user.id, {
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        include: [
          {
            model: Permission,
            as: 'permissions',
            through: { attributes: [] },
          },
        ],
      },
    ],
  })
    .then(user => {
      if (user) {
        // Cache permissions in request
        const permissions = user.roles.reduce((perms, role) => {
          role.permissions.forEach(perm => perms.add(perm.name));
          return perms;
        }, new Set());

        req.user.permissions = Array.from(permissions);
        req.user.roles = user.roles.map(role => role.name);
      }
      next();
    })
    .catch(() => {
      next(); // Continue without caching
    });
}
