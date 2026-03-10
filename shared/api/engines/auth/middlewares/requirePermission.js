/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ADMIN_ROLE } from '../constants';

/**
 * Hook channel name for permission resolution.
 * Modules can register a listener on this channel to populate `req.user.permissions`.
 */
const HOOK_CHANNEL = 'auth.permissions';

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
export function hasPermission(userPermissions, requiredPermission) {
  // Guard: no permission to check
  if (!requiredPermission) {
    return false;
  }

  // Invalid user permissions
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
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
    if (resource === '*' && action === '*') {
      return true;
    }

    // Resource wildcard: users:* matches users:read, users:write, etc.
    if (resource === requiredResource && action === '*') {
      return true;
    }

    // Action wildcard: *:read matches users:read, groups:read, etc.
    if (resource === '*' && action === requiredAction) {
      return true;
    }

    return false;
  });
}

/**
 * Shared helper: validate auth, check admin bypass, and resolve permissions via hook.
 *
 * @param {Object} req - Express request
 * @param {boolean} [adminBypass=true] - Whether admin role bypasses the check
 * @returns {Promise<{ skip: boolean, isAdmin: boolean, error: Error|null }>}
 */
async function resolvePermissions(req, adminBypass = true) {
  // 1. Check if user is authenticated
  if (!req.user) {
    const error = new Error('User not authenticated');
    error.name = 'AuthenticationRequiredError';
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    return { skip: false, isAdmin: false, error };
  }

  // 2. Admin role bypasses all checks (when enabled)
  if (
    adminBypass &&
    Array.isArray(req.user.roles) &&
    req.user.roles.includes(ADMIN_ROLE)
  ) {
    return { skip: true, isAdmin: true, error: null };
  }

  // 3. Use hook to let modules resolve permissions if not already populated
  if (!req.user.permissions) {
    const hook = req.app.get('hook');
    if (hook && hook.has(HOOK_CHANNEL)) {
      await hook(HOOK_CHANNEL).emit('resolve', req);
    }
  }

  return { skip: false, isAdmin: false, error: null };
}

/**
 * Middleware to check if user has required permission(s)
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.permissions` hook to let modules populate permissions.
 *
 * Supports wildcard matching via `hasPermission`:
 * - '*:*' matches all permissions (super admin)
 * - 'users:*' matches all actions on users resource
 * - '*:read' matches read action on all resources
 *
 * @param {Object} options - Options object or first permission string
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @param {string[]} options.permissions - One or more permissions to check (user must have ALL)
 * @returns {Function} Express middleware
 *
 * @example
 * // Single permission
 * router.get('/users', requirePermission('users:read'), controller.list);
 *
 * // Multiple permissions (user must have ALL)
 * router.post('/users', requirePermission('users:read', 'users:write'), controller.create);
 *
 * // Disable admin bypass
 * router.delete('/self', requirePermission({ permissions: ['users:delete-self'], adminBypass: false }), controller.deleteSelf);
 */
export function requirePermission(...args) {
  // Support both requirePermission('perm1', 'perm2') and requirePermission({ permissions, adminBypass })
  let permissions;
  let adminBypass = true;

  if (
    args.length === 1 &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    ({ permissions = [], adminBypass = true } = args[0]);
  } else {
    permissions = args;
  }

  return async (req, res, next) => {
    // Resolve permissions (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolvePermissions(req, adminBypass);
    if (error) return next(error);
    if (skip) return next();

    // Check permissions (includes direct match + wildcard support)
    const userPermissions = req.user.permissions || [];
    const missing = permissions.filter(
      perm => !hasPermission(userPermissions, perm),
    );

    if (missing.length === 0) {
      return next();
    }

    // Permission denied
    const denied = new Error(`Permission denied: ${missing.join(', ')}`);
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'PERMISSION_DENIED';
    return next(denied);
  };
}

/**
 * Middleware to check if user has ANY of the required permissions
 *
 * Assumes `req.user` is already populated (use after requireAuth).
 * Emits `auth.permissions` hook to let modules populate permissions.
 * User needs at least ONE of the listed permissions to pass.
 *
 * @param {Object} options - Options object or first permission string
 * @param {boolean} [options.adminBypass=true] - Whether admin role bypasses the check
 * @param {string[]} options.permissions - One or more permissions to check (user must have ANY)
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/content', requireAnyPermission('posts:read', 'posts:moderate'), controller.get);
 *
 * // Disable admin bypass
 * router.get('/audit', requireAnyPermission({ permissions: ['audit:read'], adminBypass: false }), controller.audit);
 */
export function requireAnyPermission(...args) {
  // Support both requireAnyPermission('perm1', 'perm2') and requireAnyPermission({ permissions, adminBypass })
  let permissions;
  let adminBypass = true;

  if (
    args.length === 1 &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    ({ permissions = [], adminBypass = true } = args[0]);
  } else {
    permissions = args;
  }

  return async (req, res, next) => {
    // Resolve permissions (check auth, admin bypass, populate from DB)
    const { skip, error } = await resolvePermissions(req, adminBypass);
    if (error) return next(error);
    if (skip) return next();

    // Check if user has ANY of the permissions
    const userPermissions = req.user.permissions || [];
    const hasAny = permissions.some(perm =>
      hasPermission(userPermissions, perm),
    );

    if (hasAny) {
      return next();
    }

    // Permission denied
    const denied = new Error(
      `Permission denied. Required any of: ${permissions.join(', ')}`,
    );
    denied.name = 'ForbiddenError';
    denied.status = 403;
    denied.code = 'PERMISSION_DENIED';
    return next(denied);
  };
}
