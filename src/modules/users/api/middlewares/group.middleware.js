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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return http.sendServerError(res, 'Database models not available');
      }
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return http.sendUnauthorized(res, 'User not found');
      }

      // Check if user is in the required group
      const isInGroup = user.groups.some(group => group.name === groupName);

      if (!isInGroup) {
        return http.sendForbidden(
          res,
          `Access denied. Required group: ${groupName}`,
        );
      }

      next();
    } catch (error) {
      return http.sendServerError(res, 'Group check failed');
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return http.sendServerError(res, 'Database models not available');
      }
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return http.sendUnauthorized(res, 'User not found');
      }

      // Check if user is in any of the required groups
      const isInAnyGroup = user.groups.some(group =>
        groupNames.includes(group.name),
      );

      if (!isInAnyGroup) {
        return http.sendForbidden(
          res,
          `Access denied. Required any group: ${groupNames.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      return http.sendServerError(res, 'Groups check failed');
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return http.sendServerError(res, 'Database models not available');
      }
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return http.sendUnauthorized(res, 'User not found');
      }

      // Get user's group names
      const userGroupNames = user.groups.map(group => group.name);

      // Check if user is in all required groups
      const missingGroups = groupNames.filter(
        groupName => !userGroupNames.includes(groupName),
      );

      if (missingGroups.length > 0) {
        return http.sendForbidden(
          res,
          `Access denied. Missing groups: ${missingGroups.join(', ')}`,
        );
      }

      next();
    } catch (error) {
      return http.sendServerError(res, 'Groups check failed');
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
    const http = req.app.get('http');

    if (!req.user) {
      return http.sendUnauthorized(res, 'Authentication required');
    }

    try {
      const models = req.app.get('models');
      if (!models) {
        return http.sendServerError(res, 'Database models not available');
      }
      const { User, Group } = models;

      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Group,
            as: 'groups',
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!user) {
        return http.sendUnauthorized(res, 'User not found');
      }

      // Get minimum required level
      const minimumLevel = groupHierarchy.indexOf(minimumGroup);
      if (minimumLevel === -1) {
        return http.sendServerError(res, 'Invalid minimum group configuration');
      }

      // Check if user has any group at or above the minimum level
      const userGroupLevels = user.groups
        .map(group => groupHierarchy.indexOf(group.name))
        .filter(level => level !== -1);

      const hasRequiredLevel = userGroupLevels.some(
        level => level >= minimumLevel,
      );

      if (!hasRequiredLevel) {
        return http.sendForbidden(
          res,
          `Access denied. Minimum group level required: ${minimumGroup}`,
        );
      }

      next();
    } catch (error) {
      return http.sendServerError(res, 'Group level check failed');
    }
  };
}
