/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Default active plugins — seeded as active on first run.
 * Each entry maps the built plugin key to its display metadata.
 */
const DEFAULT_PLUGINS = [
  {
    key: 'rsk_plugin_quick_access',
    name: '@rsk-plugin/quick-access',
    description: 'Quick login with demo user accounts',
    version: '1.0.0',
  },
];

/**
 * Run the seed — idempotent via findOrCreate
 */
export async function up(_, { container }) {
  const { Plugin } = container.resolve('models');
  const now = new Date();

  for (const plugin of DEFAULT_PLUGINS) {
    await Plugin.findOrCreate({
      where: { key: plugin.key },
      defaults: {
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
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
  const { Plugin } = container.resolve('models');
  const { Op } = Sequelize;

  await Plugin.destroy({
    where: {
      key: {
        [Op.in]: DEFAULT_PLUGINS.map(p => p.key),
      },
    },
    force: true,
  });
}
