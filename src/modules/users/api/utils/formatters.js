/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { collectUserRBACData, isAdmin } from './rbac/collector';
import { DEFAULT_ROLE } from '../constants/rbac';

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
export async function formatUserResponse(user, options) {
  const opts = options || {};
  const { rbacData } = opts;
  const includePermissions = opts.includePermissions !== false;

  // Collect RBAC data if not provided
  const rbac = rbacData || collectUserRBACData(user);

  // Ensure profile is a flat object
  const profile = user.profile || {};

  const result = {
    // Core user fields
    id: user.id,
    email: user.email,
    email_confirmed: user.email_confirmed,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,

    // Profile fields (nested under profile)
    profile,

    // RBAC fields
    is_admin: isAdmin({ roles: rbac.roles }),
    roles: rbac.roles.length > 0 ? rbac.roles : [DEFAULT_ROLE],
    groups: rbac.groups,
  };

  // Optionally include permissions
  if (includePermissions) {
    result.permissions = rbac.permissions;
  }

  return result;
}
