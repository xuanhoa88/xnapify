/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Store permission IDs for reference
export const extensionPermissionIds = {
  extensionsCreate: uuidv4(),
  extensionsRead: uuidv4(),
  extensionsUpdate: uuidv4(),
  extensionsDelete: uuidv4(),
  extensionsInstall: uuidv4(),
};

/**
 * Run the seed
 */
export async function up(_, { container }) {
  const { Permission } = container.resolve('models');
  const now = new Date();

  const permissions = [
    {
      id: extensionPermissionIds.extensionsCreate,
      resource: 'extensions',
      action: 'create',
      description: 'Create extensions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: extensionPermissionIds.extensionsRead,
      resource: 'extensions',
      action: 'read',
      description: 'View extensions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: extensionPermissionIds.extensionsUpdate,
      resource: 'extensions',
      action: 'update',
      description: 'Update extensions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: extensionPermissionIds.extensionsDelete,
      resource: 'extensions',
      action: 'delete',
      description: 'Delete extensions',
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
export async function down({ Sequelize }, { container }) {
  const { Permission } = container.resolve('models');
  const { Op } = Sequelize;

  await Permission.destroy({
    where: {
      resource: 'extensions',
      action: {
        [Op.in]: ['create', 'read', 'update', 'delete'],
      },
    },
    force: true, // Hard delete
  });
}
