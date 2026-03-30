/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default active extensions — seeded as active on first run.
 * Each entry maps the built extension key to its display metadata.
 */
const DEFAULT_EXTENSIONS = [
  {
    key: 'xnapify_extension_quick_access',
    name: '@xnapify-extension/quick-access',
    description: 'Quick login with demo user accounts',
    version: '1.0.0',
  },
];

/**
 * Run the seed — idempotent via findOrCreate
 */
export async function up(_, { container }) {
  const { Extension } = container.resolve('models');
  const now = new Date();

  for (const extension of DEFAULT_EXTENSIONS) {
    await Extension.findOrCreate({
      where: { key: extension.key },
      defaults: {
        name: extension.name,
        description: extension.description,
        version: extension.version,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

/**
 * Revert the seed
 */
export async function down({ Sequelize }, { container }) {
  const { Extension } = container.resolve('models');
  const { Op } = Sequelize;

  await Extension.destroy({
    where: {
      key: {
        [Op.in]: DEFAULT_EXTENSIONS.map(p => p.key),
      },
    },
    force: true,
  });
}
