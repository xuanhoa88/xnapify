/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ADMIN_ROLE,
  DEFAULT_ACTIONS,
  DEFAULT_RESOURCES,
} from '../../../../../shared/api/engines/auth';

/**
 * Extract role name and permissions into sets
 *
 * @param {Object} role - Role object
 * @param {Set} roles - Set of role names
 * @param {Set} permissions - Set of permission strings
 */
function extractRoleData(role, roles, permissions) {
  roles.add(role.name);
  if (Array.isArray(role.permissions)) {
    role.permissions.forEach(p => {
      permissions.add(`${p.resource}:${p.action}`);
    });
  }
}

/**
 * Collect effective RBAC data from user object
 *
 * Extracts roles, permissions, and groups from a user object
 * with nested associations (direct roles and group-inherited roles).
 *
 * @param {Object} user - User with roles/groups associations
 * @returns {Object} { roles: string[], permissions: string[], groups: string[] }
 */
export function collectUserRBACData(user) {
  const roles = new Set();
  const permissions = new Set();
  const groups = new Set();

  // Direct roles
  if (Array.isArray(user.roles)) {
    user.roles.forEach(role => extractRoleData(role, roles, permissions));
  }

  // Group roles
  if (Array.isArray(user.groups)) {
    user.groups.forEach(group => {
      groups.add(group.name);
      if (Array.isArray(group.roles)) {
        group.roles.forEach(role => extractRoleData(role, roles, permissions));
      }
    });
  }

  return {
    id: user.id,
    email: user.email,
    roles: [...roles],
    permissions: [...permissions],
    groups: [...groups],
  };
}

/**
 * Check if a user object is an admin (RBAC compatible)
 * Checks for: is_admin flag, admin role, or super admin permission (*:*)
 *
 * @param {object} user - User object with roles/permissions
 * @returns {boolean} True if user is an admin
 */
export function isAdmin(user) {
  try {
    if (!user) return false;
    if (user.is_admin === true) return true;
    if (Array.isArray(user.roles) && user.roles.includes(ADMIN_ROLE))
      return true;
    if (
      Array.isArray(user.permissions) &&
      user.permissions.includes(
        `${DEFAULT_RESOURCES.ALL}:${DEFAULT_ACTIONS.MANAGE}`,
      )
    )
      return true;
  } catch (error) {
    console.error('Error checking admin status:', error);
  }
  return false;
}
