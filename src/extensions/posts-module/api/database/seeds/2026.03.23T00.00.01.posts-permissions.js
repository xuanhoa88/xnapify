/**
 * Seed: Register posts permissions
 *
 * Adds CRUD permissions for the 'posts' resource.
 */

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
  const { Permission } = container.resolve('models');

  for (const perm of POSTS_PERMISSIONS) {
    await Permission.findOrCreate({
      where: { resource: perm.resource, action: perm.action },
      defaults: perm,
    });
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
