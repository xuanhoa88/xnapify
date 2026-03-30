/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

export const marketplacePermissionIds = {
  marketplaceSubmit: uuidv4(),
  marketplaceReview: uuidv4(),
  marketplaceManage: uuidv4(),
};

/**
 * Run the seed — create marketplace permissions
 */
export async function up(_, { container }) {
  const { Permission } = container.resolve('models');
  const now = new Date();

  const permissions = [
    {
      id: marketplacePermissionIds.marketplaceSubmit,
      resource: 'marketplace',
      action: 'submit',
      description: 'Submit extensions to the marketplace',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: marketplacePermissionIds.marketplaceReview,
      resource: 'marketplace',
      action: 'review',
      description: 'Review marketplace submissions',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: marketplacePermissionIds.marketplaceManage,
      resource: 'marketplace',
      action: 'manage',
      description: 'Manage marketplace listings',
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
      resource: 'marketplace',
      action: {
        [Op.in]: ['submit', 'review', 'manage'],
      },
    },
    force: true,
  });
}
