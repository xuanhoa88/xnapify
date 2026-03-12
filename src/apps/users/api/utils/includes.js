/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// Shared Sequelize include builders for User queries
// ========================================================================

/**
 * Build the base UserProfile include.
 *
 * @param {Object} models - Database models
 * @returns {Object} Sequelize include config
 */
function profileInclude(models) {
  return {
    model: models.UserProfile,
    as: 'profile',
    required: false,
  };
}

/**
 * Build a Roles include, optionally with nested Permissions.
 *
 * @param {Object} models - Database models
 * @param {Object} [opts]
 * @param {string[]} [opts.attributes] - Role attributes to select
 * @param {boolean}  [opts.includePermissions] - Nest active permissions
 * @returns {Object} Sequelize include config
 */
function rolesInclude(models, opts = {}) {
  const {
    attributes = ['id', 'name', 'description'],
    includePermissions = false,
  } = opts;

  const include = {
    model: models.Role,
    as: 'roles',
    attributes,
    through: { attributes: [] },
  };

  if (includePermissions && models.Permission) {
    include.include = [
      {
        model: models.Permission,
        as: 'permissions',
        attributes: ['resource', 'action'],
        where: { is_active: true },
        required: false,
        through: { attributes: [] },
      },
    ];
  }

  return include;
}

/**
 * Build a Groups include with nested Roles (and optionally Permissions).
 *
 * @param {Object} models - Database models
 * @param {Object} [opts]
 * @param {string[]} [opts.attributes] - Group attributes to select
 * @param {boolean}  [opts.includePermissions] - Nest active permissions inside roles
 * @returns {Object} Sequelize include config
 */
function groupsInclude(models, opts = {}) {
  const {
    attributes = ['id', 'name', 'description'],
    includePermissions = false,
  } = opts;

  return {
    model: models.Group,
    as: 'groups',
    attributes,
    required: false,
    through: { attributes: [] },
    include: [rolesInclude(models, { includePermissions })],
  };
}

/**
 * Full User + Profile + Roles + Groups includes.
 *
 * @param {Object} models - Database models
 * @param {Object} [opts]
 * @param {boolean}  [opts.includePermissions] - Include active permissions in roles
 * @param {string[]} [opts.roleAttributes]  - Override role attributes
 * @param {string[]} [opts.groupAttributes] - Override group attributes
 * @returns {Object[]} Array of Sequelize include configs
 */
export function userFullIncludes(models, opts = {}) {
  const { includePermissions = false, roleAttributes, groupAttributes } = opts;

  return [
    profileInclude(models),
    rolesInclude(models, {
      attributes: roleAttributes,
      includePermissions,
    }),
    groupsInclude(models, {
      attributes: groupAttributes,
      includePermissions,
    }),
  ];
}

/**
 * Format a Sequelize User instance into a plain admin-style response.
 *
 * This centralises the manual { id, email, roles, groups, profile } mapping
 * that was previously duplicated across createUser, getUserById,
 * updateUserById, and getUserList.
 *
 * @param {Object} user - Sequelize User instance (with profile, roles, groups loaded)
 * @param {Object} [opts]
 * @param {string}   [opts.defaultRoleName] - Fallback role if user has none
 * @param {string[]} [opts.extraFields]     - Additional top-level User fields to include
 * @returns {Object} Plain response object
 */
export function formatAdminUserResponse(user, opts = {}) {
  const { defaultRoleName, extraFields = [] } = opts;

  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;

  const base = {
    id: plain.id,
    email: plain.email,
    email_confirmed: plain.email_confirmed,
    is_active: plain.is_active,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    profile: plain.profile || {},
    roles: (Array.isArray(plain.roles) && plain.roles.length > 0
      ? plain.roles.map(r => (typeof r === 'string' ? r : r.name))
      : [defaultRoleName]
    ).filter(Boolean),
    groups: Array.isArray(plain.groups) ? plain.groups : [],
  };

  // Merge any extra fields the caller wants (e.g. is_locked, failed_login_attempts)
  for (const field of extraFields) {
    if (plain[field] !== undefined) {
      base[field] = plain[field];
    }
  }

  return base;
}
