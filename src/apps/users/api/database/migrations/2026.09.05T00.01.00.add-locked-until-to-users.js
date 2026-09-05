/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Replace permanent lockout with a time-boxed lockout.
 *
 * `is_locked` remains as the administrative (manual) lock. Automatic locks
 * triggered by failed logins now set `locked_until`, which expires on its own
 * so an attacker cannot permanently deny a victim access by spamming bad
 * passwords.
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.addColumn('users', 'locked_until', {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Automatic lockout expiry after repeated failed logins',
  });
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.removeColumn('users', 'locked_until');
}
