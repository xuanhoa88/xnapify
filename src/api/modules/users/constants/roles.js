/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default role assigned to new users.
 */
export const DEFAULT_ROLE = 'user';

/**
 * Staff role
 */
export const STAFF_ROLE = 'staff';

/**
 * Admin role
 */
export const ADMIN_ROLE = 'admin';

/**
 * Moderator role
 */
export const MODERATOR_ROLE = 'moderator';

/**
 * List of all system roles recognized by the application.
 * Add new roles here to propagate everywhere.
 */
export const SYSTEM_ROLES = [
  DEFAULT_ROLE,
  STAFF_ROLE,
  ADMIN_ROLE,
  MODERATOR_ROLE,
];

/**
 * Helper: Check if a user object is an admin (RBAC compatible)
 * Accepts user object with `role`, `roles`, or `is_admin` fields.
 * @param {object} user
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user) return false;
  if (user.is_admin === true) return true;
  if (user.role && user.role === ADMIN_ROLE) return true;
  if (Array.isArray(user.roles) && user.roles.includes(ADMIN_ROLE)) return true;
  return false;
}
