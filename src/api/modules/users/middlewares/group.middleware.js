/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// GROUP-BASED AUTHORIZATION MIDDLEWARES
// ========================================================================

/**
 * Group-based authorization middleware
 *
 * Requires user to be a member of a specific group.
 *
 * @param {string} groupName - Required group name
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/team/dashboard', requireGroup('developers'), controller.getTeamDashboard);
 */
export function requireGroup(groupName) {
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
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user is in the required group
      const isInGroup = user.groups.some(group => group.name === groupName);

      if (!isInGroup) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required group: ${groupName}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Group check failed',
      });
    }
  };
}

/**
 * Multiple groups authorization middleware
 *
 * Requires user to be a member of ANY of the specified groups.
 *
 * @param {string[]} groupNames - Array of group names
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/admin/panel', requireAnyGroup(['administrators', 'moderators']), controller.getAdminPanel);
 */
export function requireAnyGroup(groupNames) {
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
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user is in any of the required groups
      const isInAnyGroup = user.groups.some(group =>
        groupNames.includes(group.name),
      );

      if (!isInAnyGroup) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required any group: ${groupNames.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Groups check failed',
      });
    }
  };
}

/**
 * All groups authorization middleware
 *
 * Requires user to be a member of ALL specified groups.
 *
 * @param {string[]} groupNames - Array of group names (all required)
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/special/access', requireAllGroups(['developers', 'senior']), controller.specialAccess);
 */
export function requireAllGroups(groupNames) {
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
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get user's group names
      const userGroupNames = user.groups.map(group => group.name);

      // Check if user is in all required groups
      const missingGroups = groupNames.filter(
        groupName => !userGroupNames.includes(groupName),
      );

      if (missingGroups.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Missing groups: ${missingGroups.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Groups check failed',
      });
    }
  };
}

/**
 * Group hierarchy middleware
 *
 * Checks if user belongs to a group at or above a certain level in hierarchy.
 *
 * @param {string} minimumGroup - Minimum required group level
 * @param {string[]} groupHierarchy - Array of groups in ascending order of privilege
 * @returns {Function} Express middleware function
 *
 * @example
 * const hierarchy = ['junior', 'senior', 'lead', 'manager'];
 * router.get('/leadership', requireGroupLevel('lead', hierarchy), controller.leadership);
 */
export function requireGroupLevel(minimumGroup, groupHierarchy) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get minimum required level
      const minimumLevel = groupHierarchy.indexOf(minimumGroup);
      if (minimumLevel === -1) {
        return res.status(500).json({
          success: false,
          error: 'Invalid minimum group configuration',
        });
      }

      // Check if user has any group at or above the minimum level
      const userGroupLevels = user.groups
        .map(group => groupHierarchy.indexOf(group.name))
        .filter(level => level !== -1);

      const hasRequiredLevel = userGroupLevels.some(
        level => level >= minimumLevel,
      );

      if (!hasRequiredLevel) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Minimum group level required: ${minimumGroup}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Group level check failed',
      });
    }
  };
}

/**
 * Department-based authorization middleware
 *
 * Requires user to belong to a specific department (group category).
 *
 * @param {string} department - Required department name
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/engineering/tools', requireDepartment('engineering'), controller.getTools);
 */
export function requireDepartment(department) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      const models = req.app.get('models');
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
            where: {
              category: department, // Assuming groups have a category field
            },
            required: false,
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user belongs to any group in the department
      if (user.groups.length === 0) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required department: ${department}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Department check failed',
      });
    }
  };
}

/**
 * Team-based authorization middleware
 *
 * Requires user to be in the same team as the resource being accessed.
 *
 * @param {string} resource_idParam - Parameter name for resource ID
 * @param {string} resourceModel - Model name for the resource
 * @param {string} teamField - Field name that contains the team ID
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/projects/:id', requireSameTeam('id', 'Project', 'teamId'), controller.getProject);
 */
export function requireSameTeam(
  resource_idParam = 'id',
  resourceModel,
  teamField = 'teamId',
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
      const { User, Group } = models;
      const ResourceModel = models[resourceModel];

      if (!ResourceModel) {
        return res.status(500).json({
          success: false,
          error: `Model ${resourceModel} not found`,
        });
      }

      // Get user's teams
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            through: { attributes: [] },
            where: {
              type: 'team', // Assuming groups have a type field to distinguish teams
            },
            required: false,
          },
        ],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get resource
      const resource_id = req.params[resource_idParam];
      const resource = await ResourceModel.findByPk(resource_id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      // Check if user is in the same team as the resource
      const userTeamIds = user.groups.map(group => group.id);
      const resourceTeamId = resource[teamField];

      if (!userTeamIds.includes(resourceTeamId)) {
        return res.status(403).json({
          success: false,
          error:
            'Access denied. You must be in the same team to access this resource.',
        });
      }

      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Team authorization failed',
      });
    }
  };
}

/**
 * Group membership caching middleware
 *
 * Caches user group memberships for the duration of the request.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function cacheUserGroups(req, res, next) {
  if (!req.user) {
    return next();
  }

  // Skip if groups already cached
  if (req.user.groups) {
    return next();
  }

  const models = req.app.get('models');
  if (!models) {
    return next();
  }

  const { User, Group } = models;

  User.findByPk(req.user.id, {
    include: [
      {
        model: Group,
        as: 'groups',
        through: { attributes: [] },
      },
    ],
  })
    .then(user => {
      if (user) {
        // Cache groups in request
        req.user.groups = user.groups.map(group => ({
          id: group.id,
          name: group.name,
          category: group.category,
          type: group.type,
        }));
      }
      next();
    })
    .catch(() => {
      next(); // Continue without caching
    });
}
