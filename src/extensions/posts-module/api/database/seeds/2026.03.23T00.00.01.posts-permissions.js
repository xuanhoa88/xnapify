/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Seed: Register posts permissions
 *
 * Adds CRUD permissions for the 'posts' resource and grants them to the
 * roles that administer content.
 *
 * Creating a Permission row on its own grants nobody anything: the admin
 * sidebar filters entries by `item.permission`, so an extension that seeds
 * permissions without attaching them to a role registers a menu entry that
 * is then filtered out for every user who is not flagged `is_admin`. The
 * first-party modules all pair the two (see
 * src/apps/activities/api/database/seeds/*-permissions.js).
 */

import { v4 as uuidv4 } from 'uuid';

/** Roles that get the posts permissions on activation. */
const GRANT_TO_ROLES = ['admin', 'mod'];

const POSTS_PERMISSIONS = [
  { resource: 'posts', action: 'create', description: 'Create posts' },
  { resource: 'posts', action: 'read', description: 'View posts' },
  { resource: 'posts', action: 'update', description: 'Update posts' },
  { resource: 'posts', action: 'delete', description: 'Delete posts' },
];

/**
 * Run the seed
 */
export async function up(_, { container }) {
  const { Permission, Role, RolePermission } = container.resolve('models');

  const roles = await Role.findAll({ where: { name: GRANT_TO_ROLES } });

  for (const perm of POSTS_PERMISSIONS) {
    const [permission] = await Permission.findOrCreate({
      where: { resource: perm.resource, action: perm.action },
      defaults: { id: uuidv4(), is_active: true, ...perm },
    });

    for (const role of roles) {
      await RolePermission.findOrCreate({
        where: { role_id: role.id, permission_id: permission.id },
        defaults: {
          id: uuidv4(),
          role_id: role.id,
          permission_id: permission.id,
        },
      });
    }
  }
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Permission } = container.resolve('models');

  await Permission.destroy({
    where: { resource: 'posts' },
    force: true,
  });
}
