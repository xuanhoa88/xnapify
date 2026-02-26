/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Store permission IDs for reference
export const pluginPermissionIds = {
  pluginsCreate: uuidv4(),
  pluginsRead: uuidv4(),
  pluginsUpdate: uuidv4(),
  pluginsDelete: uuidv4(),
  pluginsInstall: uuidv4(),
};

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const { Permission } = app.get('models');
  const now = new Date();

  const permissions = [
    {
      id: pluginPermissionIds.pluginsCreate,
      resource: 'plugins',
      action: 'create',
      description: 'Create plugins',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: pluginPermissionIds.pluginsRead,
      resource: 'plugins',
      action: 'read',
      description: 'View plugins',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: pluginPermissionIds.pluginsUpdate,
      resource: 'plugins',
      action: 'update',
      description: 'Update plugins',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: pluginPermissionIds.pluginsDelete,
      resource: 'plugins',
      action: 'delete',
      description: 'Delete plugins',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await Permission.bulkCreate(permissions);
}

/**
 * Revert the seed
 */
export async function down({ Sequelize }, { app }) {
  const { Permission } = app.get('models');
  const { Op } = Sequelize;

  await Permission.destroy({
    where: {
      resource: 'plugins',
      action: {
        [Op.in]: ['create', 'read', 'update', 'delete'],
      },
    },
    force: true, // Hard delete
  });
}
