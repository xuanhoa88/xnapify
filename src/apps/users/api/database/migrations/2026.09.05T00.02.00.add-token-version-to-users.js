/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Durable "sign out everywhere" marker.
 *
 * Every access token embeds the user's `token_version` as its `ver` claim.
 * Password changes, deactivation and admin revocation increment the column,
 * after which the auth middlewares reject any token carrying an older value.
 * Unlike the in-process session denylist this survives restarts.
 */

import { assertColumnDropSupported } from '@shared/api/engines/db/migrationGuards.js';

export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.addColumn('users', 'token_version', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Bumped to invalidate every access token issued before the bump',
  });
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  assertColumnDropSupported(queryInterface, {
    table: 'users',
    column: 'token_version',
  });
  await queryInterface.removeColumn('users', 'token_version');
}
