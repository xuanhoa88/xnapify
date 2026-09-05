/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { withSchemaLock } from './migrator.js';

function fakeConnection(dialect, { poolMax = 5, lockResult = 1 } = {}) {
  const calls = [];
  return {
    calls,
    getDialect: () => dialect,
    options: { pool: { max: poolMax } },
    transaction: jest.fn(async cb => cb({ id: 'tx' })),
    query: jest.fn(async (sql, opts) => {
      calls.push(sql);
      expect(opts.transaction).toEqual({ id: 'tx' });
      if (sql.includes('GET_LOCK')) return [[{ acquired: lockResult }]];
      return [[]];
    }),
  };
}

describe('withSchemaLock', () => {
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

  it('takes a transaction-scoped advisory lock on Postgres', async () => {
    const connection = fakeConnection('postgres');
    const fn = jest.fn(async () => 'result');

    await expect(withSchemaLock(connection, fn, { logger })).resolves.toBe(
      'result',
    );
    expect(connection.transaction).toHaveBeenCalledTimes(1);
    expect(connection.calls).toEqual(['SELECT pg_advisory_xact_lock(:key)']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses GET_LOCK / RELEASE_LOCK on MySQL and releases on failure', async () => {
    const connection = fakeConnection('mysql');
    await expect(
      withSchemaLock(
        connection,
        async () => {
          throw new Error('migration exploded');
        },
        { logger },
      ),
    ).rejects.toThrow('migration exploded');
    expect(connection.calls).toEqual([
      'SELECT GET_LOCK(:name, :timeout) AS acquired',
      'SELECT RELEASE_LOCK(:name)',
    ]);
  });

  it('fails fast when the MySQL lock cannot be acquired', async () => {
    const connection = fakeConnection('mariadb', { lockResult: 0 });
    const fn = jest.fn();
    await expect(
      withSchemaLock(connection, fn, { logger, timeoutSeconds: 1 }),
    ).rejects.toMatchObject({ code: 'SCHEMA_LOCK_TIMEOUT' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs unlocked on SQLite and on pools too small to hold a lock', async () => {
    const sqlite = fakeConnection('sqlite');
    await withSchemaLock(sqlite, async () => {}, { logger });
    expect(sqlite.transaction).not.toHaveBeenCalled();

    const tiny = fakeConnection('postgres', { poolMax: 1 });
    await withSchemaLock(tiny, async () => {}, { logger });
    expect(tiny.transaction).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Schema lock skipped'),
    );
  });
});
