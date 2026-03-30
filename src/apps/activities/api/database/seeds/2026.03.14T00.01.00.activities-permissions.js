/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Permissions Seed - Creates the activities:read permission
 */

import { v4 as uuidv4 } from 'uuid';

export async function up(_, { container }) {
  const { Permission, Role, RolePermission } = container.resolve('models');
  const { DEFAULT_ACTIONS } = container.resolve('auth');

  // Create activities:read permission
  const [permission] = await Permission.findOrCreate({
    where: { resource: 'activities', action: DEFAULT_ACTIONS.READ },
    defaults: {
      id: uuidv4(),
      resource: 'activities',
      action: DEFAULT_ACTIONS.READ,
      description: 'View system activities logs',
      is_active: true,
    },
  });

  // Assign to admin and mod roles
  const roles = await Role.findAll({
    where: { name: ['admin', 'mod'] },
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

export async function down(_, { container }) {
  const { Permission } = container.resolve('models');
  const { DEFAULT_ACTIONS } = container.resolve('auth');

  // This will naturally cascade to RolePermissions via DB constraints if configured,
  // but we should be careful about deleting shared permissions if others use them.
  await Permission.destroy({
    where: { resource: 'activities', action: DEFAULT_ACTIONS.READ },
  });
}
