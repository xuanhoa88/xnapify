/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Guards for migration operations that are destructive on some dialects.
 */

/**
 * Dialect of the connection behind a queryInterface, or '' when it cannot be
 * determined (a stubbed queryInterface in a unit test, for instance).
 *
 * @param {object} queryInterface
 * @returns {string}
 */
function dialectOf(queryInterface) {
  const getDialect = queryInterface?.sequelize?.getDialect;
  return typeof getDialect === 'function'
    ? queryInterface.sequelize.getDialect()
    : '';
}

/**
 * Refuse `queryInterface.removeColumn()` on SQLite.
 *
 * SQLite has no usable `ALTER TABLE … DROP COLUMN` for Sequelize's purposes,
 * so Sequelize emulates it by rebuilding the table:
 *
 *   CREATE TABLE <t>_backup … ; INSERT INTO <t>_backup SELECT … FROM <t>;
 *   DROP TABLE <t>; ALTER TABLE <t>_backup RENAME TO <t>;
 *
 * Two things go wrong with that, both silently:
 *
 * 1. Sequelize does not wrap the rebuild in `PRAGMA foreign_keys = OFF`,
 *    while `connection.js` turns foreign keys ON for every pooled connection.
 *    The `DROP TABLE` therefore fires every `ON DELETE CASCADE` pointing at
 *    the table and wipes the child rows — refresh tokens, profiles, logins,
 *    role and group assignments — while the parent table itself survives.
 * 2. The new table is rebuilt from `describeTable()`, which cannot see
 *    explicit indexes, so every `addIndex()` from the original migration is
 *    lost — including UNIQUE ones such as `users_email_idx`.
 *
 * Neither is repairable from inside the migration, so the down() migration
 * refuses to run instead of destroying data. Reverting on SQLite means
 * restoring a backup (or recreating the development database).
 *
 * @param {object} queryInterface - Sequelize QueryInterface
 * @param {object} target
 * @param {string} target.table  - Table the column belongs to
 * @param {string} target.column - Column being dropped
 * @throws {Error} code `SQLITE_COLUMN_DROP_UNSAFE` when the dialect is sqlite
 */
export function assertColumnDropSupported(queryInterface, { table, column }) {
  if (dialectOf(queryInterface) !== 'sqlite') return;

  const error = new Error(
    `Refusing to drop "${table}.${column}" on SQLite: Sequelize emulates ` +
      `DROP COLUMN by rebuilding the table, which deletes every ON DELETE ` +
      `CASCADE child row and silently drops the table's explicit indexes ` +
      `(including UNIQUE ones). Restore a backup or recreate the database ` +
      `instead of reverting this migration.`,
  );
  error.name = 'UnsupportedMigrationError';
  error.code = 'SQLITE_COLUMN_DROP_UNSAFE';
  throw error;
}

export default assertColumnDropSupported;
