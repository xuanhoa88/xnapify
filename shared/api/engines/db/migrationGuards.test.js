/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { assertColumnDropSupported } from './migrationGuards.js';

const queryInterface = dialect => ({
  sequelize: { getDialect: () => dialect },
});

describe('assertColumnDropSupported', () => {
  it('refuses a column drop on SQLite', () => {
    // Regression: removeColumn() on SQLite rebuilds the table, which fires
    // every ON DELETE CASCADE (destroying child rows) and loses the table's
    // explicit indexes, including the UNIQUE one on users.email.
    expect(() =>
      assertColumnDropSupported(queryInterface('sqlite'), {
        table: 'users',
        column: 'token_version',
      }),
    ).toThrow(/users\.token_version/);

    try {
      assertColumnDropSupported(queryInterface('sqlite'), {
        table: 'users',
        column: 'token_version',
      });
    } catch (error) {
      expect(error.code).toBe('SQLITE_COLUMN_DROP_UNSAFE');
      expect(error.name).toBe('UnsupportedMigrationError');
    }
  });

  it('allows the drop on dialects with a real DROP COLUMN', () => {
    for (const dialect of ['postgres', 'mysql', 'mariadb']) {
      expect(() =>
        assertColumnDropSupported(queryInterface(dialect), {
          table: 'users',
          column: 'locked_until',
        }),
      ).not.toThrow();
    }
  });

  it('does not throw when the dialect cannot be determined', () => {
    expect(() =>
      assertColumnDropSupported({}, { table: 'users', column: 'x' }),
    ).not.toThrow();
  });
});
