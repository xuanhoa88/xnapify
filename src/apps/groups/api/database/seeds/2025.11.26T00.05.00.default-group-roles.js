/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Default group → role mappings.
 * Each group inherits a base role so that new members receive
 * the correct permission set automatically upon assignment.
 */
export async function up(_, { container }) {
  const { GroupRole } = container.resolve('models');
  const SEED_GROUPS = container.resolve('groups:seed_constants');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  const groupRoles = [
    // Engineering → editor (create + update content)
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.engineering,
      role_id: SEED_ROLES.editor,
    },
    // Marketing → user (standard access)
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.marketing,
      role_id: SEED_ROLES.user,
    },
    // Customer Support → moderator (read + update users/groups)
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.support,
      role_id: SEED_ROLES.mod,
    },
    // Management → admin (full access)
    {
      id: uuidv4(),
      group_id: SEED_GROUPS.management,
      role_id: SEED_ROLES.admin,
    },
  ];

  await GroupRole.bulkCreate(groupRoles);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { GroupRole } = container.resolve('models');
  const SEED_GROUPS = container.resolve('groups:seed_constants');

  await GroupRole.destroy({
    where: { group_id: Object.values(SEED_GROUPS) },
    force: true,
  });
}
