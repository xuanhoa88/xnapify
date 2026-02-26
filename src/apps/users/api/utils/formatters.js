/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  DEFAULT_ROLE,
  ADMIN_ROLE,
  DEFAULT_RESOURCES,
  DEFAULT_ACTIONS,
} from '../../../../shared/api/engines/auth';
import { collectUserRBACData } from './rbac/collector';

/**
 * Check if a user object is an admin (RBAC compatible)
 * Checks for: is_admin flag, admin role, or super admin permission (*:*)
 *
 * @param {object} user - User object with roles/permissions
 * @returns {boolean} True if user is an admin
 */
function isAdmin(user) {
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

/**
 * Format user data for API response
 *
 * Consolidated formatter used by both auth and profile endpoints.
 * Extracts user data, profile fields, and RBAC information into
 * a consistent response structure.
 *
 * @param {Object} user - Sequelize User model instance with associations
 * @param {Object} [options] - Formatting options
 * @param {Object} [options.rbacData] - Pre-collected RBAC data (skips collection)
 * @param {boolean} [options.includePermissions=true] - Include detailed permissions
 * @returns {Promise<Object>} Formatted user object
 */
export async function formatUserResponse(user, options = {}) {
  const { rbacData, includePermissions = true } = options;

  // Collect RBAC data if not provided
  const rbac = rbacData || collectUserRBACData(user);

  // Ensure profile is a flat object
  const profile = user.profile || {};

  const result = {
    // Core user fields
    id: user.id,
    email: user.email,
    is_active: user.is_active,

    // Profile fields (nested under profile)
    profile,

    // RBAC fields
    roles: rbac.roles.length > 0 ? rbac.roles : [DEFAULT_ROLE],
    groups: rbac.groups,
  };

  // Optionally include permissions
  if (includePermissions) {
    result.permissions = rbac.permissions;
  }

  return {
    ...result,
    // Check admin status
    is_admin: isAdmin({ ...result, ...rbac }),
  };
}
