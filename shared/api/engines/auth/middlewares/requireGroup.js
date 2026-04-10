/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Hook channel name for group resolution.
 * Modules can register a listener on this channel to populate `req.user.groups`.
 */
const HOOK_CHANNEL = 'auth.groups';

/**
 * Shared helper: validate auth, check admin bypass, and resolve groups via hook.
 *
 * @param {Object} req - Express request
 * @param {boolean} adminBypass - Whether admin role bypasses the check
 * @returns {Promise<{ skip: boolean, error: Error|null }>}
 */
async function resolveGroups(req, adminBypass) {
  // 1. Check if user is authenticated
  if (!req.user) {
    const error = new Error('User not authenticated');
    error.name = 'AuthenticationRequiredError';
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    return { skip: false, error };
  }

  // 2. Admin role bypasses all checks
  if (adminBypass && req.user && req.user.is_admin === true) {
    return { skip: true, error: null };
  }

  // 3. Use hook to let modules resolve groups if not already populated
  if (!req.user.groups) {
    const hook = req.app.get('container').resolve('hook');
    if (hook && hook.has(HOOK_CHANNEL)) {
      await hook(HOOK_CHANNEL).invoke('resolve', req);
    }
  }

  return { skip: false, error: null };
}

/**
 * Middleware to check if user belongs to required group(s)
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.groups` hook to let modules populate groups.
 * User must belong to ALL listed groups to pass.
 *
 * @param {...string} groups - One or more group names (user must belong to ALL)
 * @returns {Function} Express middleware
 *
 * @example
 * // Single group
 * router.get('/team', requireGroup('engineering'), controller.list);
 *
 * // Multiple groups (user must belong to ALL)
 * router.get('/shared', requireGroup('engineering', 'design'), controller.shared);
 */
export function requireGroup(...groups) {
  return async (req, res, next) => {
    // Resolve groups (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveGroups(req, true);
    if (error) return next(error);
    if (skip) return next();

    // Check if user belongs to ALL required groups
    const userGroups = req.user.groups || [];
    const missing = groups.filter(group => !userGroups.includes(group));

    if (missing.length === 0) {
      return next();
    }

    // Group denied
    const denied = new Error(`Group required: ${missing.join(', ')}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'GROUP_REQUIRED';
    return next(denied);
  };
}

/**
 * Middleware to check if user belongs to ANY of the required groups
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.groups` hook to let modules populate groups.
 * User needs to belong to at least ONE of the listed groups to pass.
 *
 * @param {...string} groups - One or more group names (user must belong to ANY)
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/content', requireAnyGroup('editors', 'moderators'), controller.list);
 */
export function requireAnyGroup(...groups) {
  return async (req, res, next) => {
    // Resolve groups (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveGroups(req, true);
    if (error) return next(error);
    if (skip) return next();

    // Check if user belongs to ANY of the required groups
    const userGroups = req.user.groups || [];
    const hasAny = groups.some(group => userGroups.includes(group));

    if (hasAny) {
      return next();
    }

    // Group denied
    const denied = new Error(
      `Group required. Need any of: ${groups.join(', ')}`,
    );
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'GROUP_REQUIRED';
    return next(denied);
  };
}

/**
 * Middleware to check if user belongs to a group at or above a minimum level
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.groups` hook to let modules populate groups.
 * User must belong to a group at or above `minimumGroup` in the hierarchy.
 *
 * @param {string} minimumGroup - Minimum required group level
 * @param {string[]} groupHierarchy - Groups in ascending order of privilege
 * @returns {Function} Express middleware
 *
 * @example
 * const hierarchy = ['junior', 'senior', 'lead', 'manager'];
 * router.get('/leadership', requireGroupLevel('lead', hierarchy), controller.leadership);
 */
export function requireGroupLevel(minimumGroup, groupHierarchy) {
  return async (req, res, next) => {
    // Resolve groups (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveGroups(req, true);
    if (error) return next(error);
    if (skip) return next();

    // Validate hierarchy configuration
    const minimumLevel = groupHierarchy.indexOf(minimumGroup);
    if (minimumLevel === -1) {
      const configError = new Error('Invalid minimum group configuration');
      configError.name = 'ConfigurationError';
      configError.status = 500;
      configError.code = 'INVALID_GROUP_CONFIG';
      return next(configError);
    }

    // Check if user has any group at or above the minimum level
    const userGroups = req.user.groups || [];
    const userLevels = userGroups
      .map(g => groupHierarchy.indexOf(g))
      .filter(level => level !== -1);

    const hasRequiredLevel = userLevels.some(level => level >= minimumLevel);

    if (hasRequiredLevel) {
      return next();
    }

    // Group level denied
    const denied = new Error(`Minimum group level required: ${minimumGroup}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'GROUP_LEVEL_REQUIRED';
    return next(denied);
  };
}
