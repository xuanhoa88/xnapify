/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ADMIN_ROLE } from '../constants';

/**
 * Hook channel name for role resolution.
 * Modules can register a listener on this channel to populate `req.user.roles`.
 */
const HOOK_CHANNEL = 'auth.roles';

/**
 * Hook channel name for dynamic role resolution.
 * Modules can register a listener on this channel to populate `req.requiredRoles`.
 */
const DYNAMIC_HOOK_CHANNEL = 'auth.dynamic_roles';

/**
 * Shared helper: validate auth, optionally check admin bypass, and resolve roles via hook.
 *
 * @param {Object} req - Express request
 * @param {boolean} [adminBypass=false] - Whether admin role bypasses the check
 * @returns {Promise<{ skip: boolean, error: Error|null }>}
 */
async function resolveRoles(req, adminBypass = false) {
  // 1. Check if user is authenticated
  if (!req.user) {
    const error = new Error('User not authenticated');
    error.name = 'AuthenticationRequiredError';
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    return { skip: false, error };
  }

  // 2. Use hook to let modules resolve roles if not already populated
  if (!req.user.roles) {
    const hook = req.app.get('container').resolve('hook');
    if (hook && hook.has(HOOK_CHANNEL)) {
      await hook(HOOK_CHANNEL).emit('resolve', req);
    }
  }

  // 3. Admin role bypasses all checks (when enabled)
  if (
    adminBypass &&
    Array.isArray(req.user.roles) &&
    req.user.roles.includes(ADMIN_ROLE)
  ) {
    return { skip: true, error: null };
  }

  return { skip: false, error: null };
}

/**
 * Middleware to check if user has required role(s)
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.roles` hook to let modules populate roles.
 * User must have ALL listed roles to pass.
 *
 * @param {Object} options - Options object or first role string
 * @param {boolean} [options.adminBypass=false] - Whether admin role bypasses the check
 * @param {string[]} options.roles - One or more roles to check (user must have ALL)
 * @returns {Function} Express middleware
 *
 * @example
 * // Single role
 * router.get('/admin', requireRole('admin'), controller.dashboard);
 *
 * // Multiple roles (user must have ALL)
 * router.post('/super', requireRole('admin', 'superuser'), controller.superAction);
 *
 * // With admin bypass
 * router.get('/moderate', requireRole({ roles: ['moderator'], adminBypass: true }), controller.moderate);
 */
export function requireRole(...args) {
  let roles;
  let adminBypass = false;

  if (
    args.length === 1 &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    ({ roles = [], adminBypass = false } = args[0]);
  } else {
    roles = args;
  }

  return async (req, res, next) => {
    // Resolve roles (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveRoles(req, adminBypass);
    if (error) return next(error);
    if (skip) return next();

    // Check if user has ALL required roles
    const userRoles = req.user.roles || [];
    const missing = roles.filter(role => !userRoles.includes(role));

    if (missing.length === 0) {
      return next();
    }

    // Role denied
    const denied = new Error(`Role required: ${missing.join(', ')}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'ROLE_REQUIRED';
    return next(denied);
  };
}

/**
 * Middleware to check if user has ANY of the required roles
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.roles` hook to let modules populate roles.
 * User needs at least ONE of the listed roles to pass.
 *
 * @param {Object} options - Options object or first role string
 * @param {boolean} [options.adminBypass=false] - Whether admin role bypasses the check
 * @param {string[]} options.roles - One or more roles to check (user must have ANY)
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/manage', requireAnyRole('admin', 'moderator'), controller.manage);
 *
 * // With admin bypass
 * router.get('/review', requireAnyRole({ roles: ['editor', 'reviewer'], adminBypass: true }), controller.review);
 */
export function requireAnyRole(...args) {
  let roles;
  let adminBypass = false;

  if (
    args.length === 1 &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    ({ roles = [], adminBypass = false } = args[0]);
  } else {
    roles = args;
  }

  return async (req, res, next) => {
    // Resolve roles (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveRoles(req, adminBypass);
    if (error) return next(error);
    if (skip) return next();

    // Check if user has ANY of the required roles
    const userRoles = req.user.roles || [];
    const hasAny = roles.some(role => userRoles.includes(role));

    if (hasAny) {
      return next();
    }

    // Role denied
    const denied = new Error(`Role required. Need any of: ${roles.join(', ')}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'ROLE_REQUIRED';
    return next(denied);
  };
}

/**
 * Middleware to check if user has a role at or above a minimum level
 * in a defined role hierarchy.
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.roles` hook to let modules populate roles.
 * User must have a role at or above `minimumRole` in the hierarchy.
 *
 * @param {string} minimumRole - Minimum required role level
 * @param {string[]} roleHierarchy - Roles in ascending order of privilege
 * @returns {Function} Express middleware
 *
 * @example
 * const hierarchy = ['viewer', 'editor', 'moderator', 'admin'];
 * router.delete('/posts/:id', requireRoleLevel('moderator', hierarchy), controller.delete);
 */
export function requireRoleLevel(minimumRole, roleHierarchy, options = {}) {
  const { adminBypass = false } = options;

  return async (req, res, next) => {
    // Resolve roles (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolveRoles(req, adminBypass);
    if (error) return next(error);
    if (skip) return next();

    // Validate hierarchy configuration
    const minimumLevel = roleHierarchy.indexOf(minimumRole);
    if (minimumLevel === -1) {
      const configError = new Error('Invalid minimum role configuration');
      configError.name = 'ConfigurationError';
      configError.status = 500;
      configError.code = 'INVALID_ROLE_CONFIG';
      return next(configError);
    }

    // Check if user has any role at or above the minimum level
    const userRoles = req.user.roles || [];
    const userLevels = userRoles
      .map(r => roleHierarchy.indexOf(r))
      .filter(level => level !== -1);

    const hasRequiredLevel = userLevels.some(level => level >= minimumLevel);

    if (hasRequiredLevel) {
      return next();
    }

    // Role level denied
    const denied = new Error(`Minimum role level required: ${minimumRole}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'ROLE_LEVEL_REQUIRED';
    return next(denied);
  };
}

/**
 * Middleware for dynamic role checking — the required role is resolved
 * at runtime via a resolver function or hook, rather than being hardcoded.
 *
 * @param {Object} options
 * @param {Function} [options.resolver] - Sync/async function (req) => string|string[]
 *   that returns the required role(s) for this request
 * @param {string} [options.resourceType] - If set, uses hook to resolve required roles
 *   (hook should set req.requiredRoles)
 * @param {boolean} [options.matchAll=false] - If true, user must have ALL resolved roles
 * @returns {Function} Express middleware
 *
 * @example
 * // Resolver-based: role depends on the project's settings
 * router.put('/projects/:id/files',
 *   requireDynamicRole({
 *     resolver: async (req) => {
 *       const project = await Project.findByPk(req.params.id);
 *       return project.editRole; // e.g. 'editor' or 'admin'
 *     },
 *   }),
 *   controller.update,
 * );
 *
 * // Hook-based: let modules decide the required role
 * router.put('/resources/:id',
 *   requireDynamicRole({ resourceType: 'resource' }),
 *   controller.update,
 * );
 */
export function requireDynamicRole(options = {}) {
  const { resolver, resourceType, matchAll = false } = options;

  return async (req, res, next) => {
    // Resolve roles (check auth, populate from DB)
    const { error } = await resolveRoles(req);
    if (error) return next(error);

    // 1. Determine required roles — via resolver fn or hook
    let requiredRoles;

    if (typeof resolver === 'function') {
      const result = await resolver(req);
      requiredRoles = Array.isArray(result) ? result : [result];
    } else if (resourceType) {
      const hook = req.app.get('container').resolve('hook');
      if (hook && hook.has(DYNAMIC_HOOK_CHANNEL)) {
        await hook(DYNAMIC_HOOK_CHANNEL).emit('resolve', req, { resourceType });
      }
      requiredRoles = req.requiredRoles || [];
    }

    // Filter out undefined/null roles just in case
    requiredRoles = (requiredRoles || []).filter(Boolean);

    if (requiredRoles.length === 0) {
      return next(); // no roles required for this context
    }

    // 2. Check user roles
    const userRoles = req.user.roles || [];
    const hasAccess = matchAll
      ? requiredRoles.every(r => userRoles.includes(r))
      : requiredRoles.some(r => userRoles.includes(r));

    if (hasAccess) {
      return next();
    }

    // 3. Denied
    const denied = new Error(
      `Dynamic role required: ${requiredRoles.join(', ')}`,
    );
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'DYNAMIC_ROLE_REQUIRED';
    return next(denied);
  };
}
