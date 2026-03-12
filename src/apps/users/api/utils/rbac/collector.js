/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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
    roles: [...roles].filter(Boolean),
    permissions: [...permissions].filter(Boolean),
    groups: [...groups].filter(Boolean),
  };
}
