/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// RBAC (Role-Based Access Control) CONSTANTS
// ========================================================================

// ------------------------------------------------------------------------
// ROLES
// Roles define a set of permissions that can be assigned to users.
// Users inherit all permissions from their assigned roles.
// ------------------------------------------------------------------------

/**
 * Default role assigned to new users
 */
export const DEFAULT_ROLE = 'user';

/**
 * Administrator role - Full system access
 */
export const ADMIN_ROLE = 'admin';

/**
 * Moderator role - Content moderation permissions
 */
export const MODERATOR_ROLE = 'mod';

/**
 * List of all system roles recognized by the application.
 * These roles cannot be deleted.
 */
export const SYSTEM_ROLES = Object.freeze([
  DEFAULT_ROLE,
  ADMIN_ROLE,
  MODERATOR_ROLE,
]);

// ------------------------------------------------------------------------
// GROUPS
// Groups are organizational units that aggregate users.
// Groups can be assigned roles, and users inherit permissions from
// the roles assigned to their groups.
// ------------------------------------------------------------------------

/**
 * Default group assigned to new users
 */
export const DEFAULT_GROUP = 'users';

/**
 * Administrator group - System administrators with full access
 */
export const ADMIN_GROUP = 'administrators';

/**
 * List of all system groups recognized by the application.
 * These groups cannot be deleted.
 */
export const SYSTEM_GROUPS = Object.freeze([DEFAULT_GROUP, ADMIN_GROUP]);

// ------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------

/**
 * Check if a user object is an admin (RBAC compatible)
 * Accepts user object with `role`, `roles`, or `is_admin` fields.
 *
 * @param {object} user - User object
 * @returns {boolean} True if user is an admin
 */
export function isAdmin(user) {
  if (!user) return false;
  if (user.is_admin === true) return true;
  if (Array.isArray(user.roles)) {
    // Handle both string array and object array with 'name' property
    return user.roles.some(
      r => (typeof r === 'string' ? r : r && r.name) === ADMIN_ROLE,
    );
  }
  return false;
}

/**
 * Check if a user has a specific role
 *
 * @param {object} user - User object
 * @param {string} roleName - Role name to check
 * @returns {boolean} True if user has the role
 */
export function hasRole(user, roleName) {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    return user.roles.some(
      r => (typeof r === 'string' ? r : r && r.name) === roleName,
    );
  }
  return false;
}

/**
 * Check if a user belongs to a specific group
 *
 * @param {object} user - User object
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if user belongs to the group
 */
export function inGroup(user, groupName) {
  if (!user) return false;
  if (Array.isArray(user.groups)) {
    return user.groups.some(
      g => (typeof g === 'string' ? g : g && g.name) === groupName,
    );
  }
  return false;
}
