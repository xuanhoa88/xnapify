/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Settings Permissions Seed — creates settings:read and settings:write
 * Follows per-module permission seeding (same as activities-permissions.js)
 */

import { v4 as uuidv4 } from 'uuid';

const NAMESPACES = ['core', 'auth', 'email', 'file', 'webhook', 'optimization'];

const PERMISSIONS = [
  ...NAMESPACES.flatMap(ns => [
    {
      resource: `settings.${ns}`,
      action: 'read',
      description: `View ${ns} settings`,
    },
    {
      resource: `settings.${ns}`,
      action: 'write',
      description: `Modify ${ns} settings`,
    },
  ]),
];

export async function up(_, { container }) {
  const { Permission, Role, RolePermission } = container.resolve('models');

  for (const perm of PERMISSIONS) {
    const [permission] = await Permission.findOrCreate({
      where: { resource: perm.resource, action: perm.action },
      defaults: {
        id: uuidv4(),
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        is_active: true,
      },
    });

    // Assign to admin role only
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (adminRole) {
      await RolePermission.findOrCreate({
        where: { role_id: adminRole.id, permission_id: permission.id },
        defaults: {
          id: uuidv4(),
          role_id: adminRole.id,
          permission_id: permission.id,
        },
      });
    }
  }
}

export async function down(_, { container }) {
  const { Permission } = container.resolve('models');

  for (const perm of PERMISSIONS) {
    await Permission.destroy({
      where: { resource: perm.resource, action: perm.action },
    });
  }
}
