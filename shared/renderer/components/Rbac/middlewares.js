/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_ACTIONS, DEFAULT_RESOURCES } from './constants';

/**
 * Check if user has a specific permission (with wildcard support)
 *
 * @param {Object} user - User object containing permissions
 * @param {string} requiredPermission - Required permission (e.g., 'users:read')
 * @returns {boolean} True if user has the permission
 */
export function checkPermission(user, requiredPermission) {
  if (!user || !user.permissions) return false;

  // Direct match
  if (user.permissions.includes(requiredPermission)) {
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
  return user.permissions.some(userPerm => {
    const parts = typeof userPerm === 'string' ? userPerm.split(':') : [];
    if (parts.length !== 2) return false;

    const [resource, action] = parts;

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
 * Check if user has ANY of the required roles
 *
 * @param {Object} user - User object containing roles
 * @param {string|string[]} role - Single role or array of roles
 * @returns {boolean}
 */
export function hasRole(user, role) {
  if (!role) return true;
  if (!user || !user.roles) return false;

  const roles = Array.isArray(role) ? role : [role];

  // Check if user has any of the required roles
  return roles.some(r => user.roles.includes(r));
}

/**
 * Check if user belongs to ANY of the required groups
 *
 * @param {Object} user - User object containing groups (as array of objects with name property)
 * @param {string|string[]} group - Single group name or array of group names
 * @returns {boolean}
 */
export function hasGroup(user, group) {
  if (!group) return true;
  if (!user || !user.groups) return false;

  const groups = Array.isArray(group) ? group : [group];
  const userGroups = user.groups.map(g => (typeof g === 'string' ? g : g.name));

  // Check if user has any of the required groups
  return groups.some(g => userGroups.includes(g));
}

/**
 * Check if user is the owner of a resource
 *
 * @param {Object} user - User object
 * @param {string} resourceOwnerId - ID of the resource owner
 * @returns {boolean}
 */
export function isOwner(user, resourceOwnerId) {
  if (!resourceOwnerId) return false;
  if (!user || !user.id) return false;

  return String(user.id) === String(resourceOwnerId);
}

/**
 * Middleware helper to require a permission for a route
 *
 * @param {string} permission - Required permission
 * @returns {Function} Middleware function
 */
export function requirePermission(permission) {
  return (ctx, next) => {
    const { store } = ctx;
    const state = store.getState();
    const user = state.user && state.user.data;

    if (!checkPermission(user, permission)) {
      const error = new Error(
        `Access denied: requires permission ${permission}`,
      );
      error.name = 'PermissionDenied';
      error.status = 403;
      throw error;
    }

    // Set permission in context for UI use
    ctx.permission = permission;
    return next();
  };
}

/**
 * Middleware helper to require a role (or one of multiple roles)
 *
 * @param {string|string[]} role - Required role(s)
 * @returns {Function} Middleware function
 */
export function requireRole(role) {
  return (ctx, next) => {
    const { store } = ctx;
    const state = store.getState();
    const user = state.user && state.user.data;

    if (!hasRole(user, role)) {
      const error = new Error(`Access denied: requires role assignment`);
      error.name = 'PermissionDenied';
      error.status = 403;
      throw error;
    }

    return next();
  };
}

/**
 * Middleware helper to require membership in a group
 *
 * @param {string|string[]} group - Required group(s)
 * @returns {Function} Middleware function
 */
export function requireGroup(group) {
  return (ctx, next) => {
    const { store } = ctx;
    const state = store.getState();
    const user = state.user && state.user.data;

    if (!hasGroup(user, group)) {
      const error = new Error(`Access denied: requires group membership`);
      error.name = 'PermissionDenied';
      error.status = 403;
      throw error;
    }

    return next();
  };
}

/**
 * Middleware helper to require ownership (matches user ID against route param)
 *
 * @param {string} resourceIdParam - Name of the route parameter containing ID to check (default: 'id')
 * @returns {Function} Middleware function
 */
export function requireOwnership(resourceIdParam = 'id') {
  return (ctx, next) => {
    const { store, params } = ctx;
    const state = store.getState();
    const user = state.user && state.user.data;
    const resourceId = params[resourceIdParam];

    if (!isOwner(user, resourceId)) {
      const error = new Error(
        'Access denied: You are not the owner of this resource',
      );
      error.name = 'PermissionDenied';
      error.status = 403;
      throw error;
    }

    return next();
  };
}
