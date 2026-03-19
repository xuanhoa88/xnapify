/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the seed
 */
export async function up(_, { container }) {
  const { Role } = container.resolve('models');

  // Get seed roles from container
  const SEED_ROLES = container.resolve('roles:seed_constants');

  const roles = [
    {
      id: SEED_ROLES.admin,
      name: 'admin',
      description: 'System administrator with full access',
      is_active: true,
    },
    {
      id: SEED_ROLES.user,
      name: 'user',
      description: 'Regular user with standard permissions',
      is_active: true,
    },
    {
      id: SEED_ROLES.mod,
      name: 'mod',
      description: 'Content moderator with moderation permissions',
      is_active: true,
    },
    {
      id: SEED_ROLES.editor,
      name: 'editor',
      description: 'Content editor with write permissions',
      is_active: true,
    },
    {
      id: SEED_ROLES.viewer,
      name: 'viewer',
      description: 'Read-only access to resources',
      is_active: true,
    },
  ];

  await Role.bulkCreate(roles);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Role } = container.resolve('models');

  // Get seed roles from container
  const SEED_ROLES = container.resolve('roles:seed_constants');

  // Remove all seeded roles by id
  await Role.destroy({
    where: {
      id: Object.values(SEED_ROLES),
    },
    force: true, // Hard delete
  });
}
