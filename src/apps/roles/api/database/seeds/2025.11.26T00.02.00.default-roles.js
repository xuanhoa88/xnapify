/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default RBAC roles — seeded on first run.
 * These map to the enterprise role hierarchy used by the
 * permission matrix and group-role assignments.
 */
export async function up(_, { container }) {
  const { Role } = container.resolve('models');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  const roles = [
    {
      id: SEED_ROLES.admin,
      name: 'admin',
      description:
        'System administrator — unrestricted access to all resources and operations.',
      is_active: true,
    },
    {
      id: SEED_ROLES.user,
      name: 'user',
      description:
        'Standard user — read access to core resources with limited self-service capabilities.',
      is_active: true,
    },
    {
      id: SEED_ROLES.mod,
      name: 'mod',
      description:
        'Content moderator — read/update access to users and groups for moderation workflows.',
      is_active: true,
    },
    {
      id: SEED_ROLES.editor,
      name: 'editor',
      description:
        'Content editor — create/read/update access to users and content resources.',
      is_active: true,
    },
    {
      id: SEED_ROLES.viewer,
      name: 'viewer',
      description:
        'Read-only observer — minimal read access for auditing and reporting.',
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
  const SEED_ROLES = container.resolve('roles:seed_constants');

  await Role.destroy({
    where: { id: Object.values(SEED_ROLES) },
    force: true,
  });
}
