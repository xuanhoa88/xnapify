/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Default role → permission matrix.
 * Follows the principle of least privilege: each role receives only
 * the permissions required for its operational scope.
 *
 *   admin   — wildcard (*:manage)
 *   mod     — read all + update users/groups
 *   editor  — read all + create/update users
 *   user    — read-only on core resources
 *   viewer  — minimal read-only
 */
export async function up(_, { container }) {
  const { RolePermission } = container.resolve('models');
  const SEED_ROLES = container.resolve('roles:seed_constants');
  const SEED_PERMISSIONS = container.resolve('permissions:seed_constants');

  const rolePermissions = [
    // =========================================================================
    // ADMIN — super-admin wildcard grants all permissions dynamically
    // =========================================================================
    {
      id: uuidv4(),
      role_id: SEED_ROLES.admin,
      permission_id: SEED_PERMISSIONS.superAdmin,
    },

    // =========================================================================
    // MODERATOR — read all core resources + update users/groups
    // =========================================================================
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.usersUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.groupsUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },

    // =========================================================================
    // EDITOR — read all core resources + create/update users
    // =========================================================================
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersCreate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.usersUpdate,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },

    // =========================================================================
    // USER — read-only on core resources
    // =========================================================================
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.user,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },

    // =========================================================================
    // VIEWER — minimal read-only for auditing
    // =========================================================================
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.usersRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.rolesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.groupsRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.viewer,
      permission_id: SEED_PERMISSIONS.permissionsRead,
    },
  ];

  await RolePermission.bulkCreate(rolePermissions);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { RolePermission } = container.resolve('models');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  await RolePermission.destroy({
    where: { role_id: Object.values(SEED_ROLES) },
    force: true,
  });
}
