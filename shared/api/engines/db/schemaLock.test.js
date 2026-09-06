/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

// Plain functions, not jest.fn(): the suite runs with `resetMocks: true`,
// which would strip a jest.fn implementation before every test.
const mockUmzug = {};

jest.mock('umzug', () => ({
  __esModule: true,
  Umzug: function MockUmzug() {
    return mockUmzug;
  },
  SequelizeStorage: function MockSequelizeStorage() {},
}));

beforeEach(() => {
  mockUmzug.pending = jest.fn(async () => []);
  mockUmzug.up = jest.fn(async () => []);
  mockUmzug.executed = jest.fn(async () => [{ name: 'users/0001' }]);
  mockUmzug.down = jest.fn(async () => [{ name: 'users/0001' }]);
});

import { revertMigrations, undoSeeds, withSchemaLock } from './migrator.js';

/**
 * Models real Postgres transaction-abort semantics, not just query results:
 * any statement error aborts the WHOLE transaction (25P02, "current
 * transaction is aborted") until a rollback, and only a savepoint — a
 * nested `connection.transaction({ transaction }, cb)` call — can roll back
 * to a point short of the outer transaction. A fake that let every later
 * query keep succeeding after one failure would certify an implementation
 * that cannot actually survive a rejected `SET LOCAL` on a real server.
 */
function fakeConnection(
  dialect,
  { poolMax = 5, lockResult = 1, database, onQuery } = {},
) {
  const calls = [];
  let aborted = false;
  let savepointDepth = 0;

  return {
    calls,
    getDialect: () => dialect,
    authenticate: jest.fn(async () => {}),
    config: { database },
    options: { pool: { max: poolMax } },
    transaction: jest.fn(async (optionsOrCb, maybeCb) => {
      const nested = typeof optionsOrCb !== 'function';
      const cb = nested ? maybeCb : optionsOrCb;
      const tx = nested ? { id: `sp${savepointDepth + 1}` } : { id: 'tx' };

      if (!nested) return cb(tx);

      savepointDepth += 1;
      try {
        return await cb(tx);
      } catch (error) {
        // ROLLBACK TO SAVEPOINT clears the aborted state the failing
        // statement just set, without touching the outer transaction.
        aborted = false;
        throw error;
      } finally {
        savepointDepth -= 1;
      }
    }),
    query: jest.fn(async (sql, opts) => {
      if (aborted) {
        const abortError = new Error(
          'current transaction is aborted, commands ignored until end of transaction block',
        );
        abortError.parent = { code: '25P02' };
        throw abortError;
      }
      calls.push({ sql, replacements: opts.replacements });
      try {
        if (onQuery) await onQuery(sql);
      } catch (error) {
        // Outside a savepoint, a failure has nothing to roll back to and
        // aborts the transaction for every statement that follows.
        if (savepointDepth === 0) aborted = true;
        throw error;
      }
      if (sql.includes('GET_LOCK')) return [[{ acquired: lockResult }]];
      return [[]];
    }),
  };
}

const sql = connection => connection.calls.map(c => c.sql);

/** A migration source the merger accepts. */
function fakeSource(prefix = 'users') {
  const context = jest.fn(() => ({ up: async () => {}, down: async () => {} }));
  context.keys = () => ['./0001.js'];
  context.resolve = key => key;
  return { context, prefix };
}

describe('withSchemaLock', () => {
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

  it('takes a transaction-scoped advisory lock on Postgres', async () => {
    const connection = fakeConnection('postgres');
    const fn = jest.fn(async () => 'result');

    await expect(withSchemaLock(connection, fn, { logger })).resolves.toBe(
      'result',
    );
    // The outer transaction plus one SAVEPOINT for the idle-timeout guard.
    expect(connection.transaction).toHaveBeenCalledTimes(2);
    expect(sql(connection)).toContain('SELECT pg_advisory_xact_lock(:key)');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('bounds the Postgres wait with lock_timeout and clears it again', async () => {
    // Regression: pg_advisory_xact_lock() is the blocking variant, so an
    // instance stuck mid-migration used to block every other boot forever.
    const connection = fakeConnection('postgres');
    await withSchemaLock(connection, async () => {}, {
      logger,
      timeoutSeconds: 30,
    });

    expect(sql(connection)).toEqual([
      'SET LOCAL idle_in_transaction_session_timeout = 0',
      "SELECT set_config('lock_timeout', :timeout, true)",
      'SELECT pg_advisory_xact_lock(:key)',
      "SELECT set_config('lock_timeout', '0', true)",
    ]);
    expect(connection.calls[1].replacements).toEqual({ timeout: '30000' });
  });

  it('disables idle_in_transaction_session_timeout before taking the lock', async () => {
    // Regression: the lock is transaction-scoped, so the holding backend sits
    // idle-in-transaction for the whole run. A managed Postgres timeout would
    // kill it and release the lock mid-migration.
    const connection = fakeConnection('postgres');
    await withSchemaLock(connection, async () => {}, { logger });

    const statements = sql(connection);
    expect(statements[0]).toBe(
      'SET LOCAL idle_in_transaction_session_timeout = 0',
    );
    expect(statements.indexOf('SELECT pg_advisory_xact_lock(:key)')).toBe(2);
  });

  it('does not touch idle_in_transaction_session_timeout on MySQL', async () => {
    // GET_LOCK is connection-scoped and wait_timeout defaults to 8h, so the
    // MySQL path is not exposed and must stay unchanged.
    const connection = fakeConnection('mysql');
    await withSchemaLock(connection, async () => {}, { logger });

    expect(sql(connection)).toEqual([
      'SELECT GET_LOCK(:name, :timeout) AS acquired',
      'SELECT RELEASE_LOCK(:name)',
    ]);
  });

  it('still runs when the SET LOCAL is rejected, recovering via its savepoint', async () => {
    // An older Postgres, CockroachDB, or Redshift doesn't know the GUC and
    // rejects it with 42704 ("unrecognized configuration parameter"); that
    // must not turn a working migration into a hard boot failure. Because
    // `fakeConnection` now models real transaction-abort semantics, this
    // only passes if the implementation actually wraps the SET LOCAL in its
    // own SAVEPOINT — a plain try/catch around the bare query would abort
    // the outer transaction and every statement after it (including the
    // advisory lock) would then reject with 25P02, failing this assertion.
    const connection = fakeConnection('postgres', {
      onQuery: statement => {
        if (statement.includes('idle_in_transaction_session_timeout')) {
          const error = new Error(
            'unrecognized configuration parameter "idle_in_transaction_session_timeout"',
          );
          error.parent = { code: '42704' };
          throw error;
        }
      },
    });
    const fn = jest.fn(async () => 'result');

    await expect(withSchemaLock(connection, fn, { logger })).resolves.toBe(
      'result',
    );
    expect(sql(connection)).toContain('SELECT pg_advisory_xact_lock(:key)');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('idle_in_transaction_session_timeout'),
    );
  });

  it('turns a Postgres lock_timeout abort into SCHEMA_LOCK_TIMEOUT', async () => {
    const connection = fakeConnection('postgres', {
      onQuery: statement => {
        if (statement.includes('pg_advisory_xact_lock')) {
          const error = new Error('canceling statement due to lock timeout');
          error.parent = { code: '55P03' };
          throw error;
        }
      },
    });
    const fn = jest.fn();

    await expect(
      withSchemaLock(connection, fn, { logger, timeoutSeconds: 5 }),
    ).rejects.toMatchObject({ code: 'SCHEMA_LOCK_TIMEOUT' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('rethrows unrelated Postgres errors untouched', async () => {
    const connection = fakeConnection('postgres', {
      onQuery: statement => {
        if (statement.includes('pg_advisory_xact_lock')) {
          const error = new Error('connection terminated');
          error.parent = { code: '08006' };
          throw error;
        }
      },
    });

    await expect(
      withSchemaLock(connection, jest.fn(), { logger }),
    ).rejects.toThrow('connection terminated');
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
    expect(sql(connection)).toEqual([
      'SELECT GET_LOCK(:name, :timeout) AS acquired',
      'SELECT RELEASE_LOCK(:name)',
    ]);
  });

  it('namespaces the server-wide MySQL lock per database', async () => {
    // Regression: a constant lock name made two xnapify databases on one
    // MySQL server serialise (and time out) each other's boot, which the
    // per-database Postgres advisory lock never does.
    const first = fakeConnection('mysql', { database: 'app_one' });
    const second = fakeConnection('mysql', { database: 'app_two' });
    await withSchemaLock(first, async () => {}, { logger });
    await withSchemaLock(second, async () => {}, { logger });

    expect(first.calls[0].replacements.name).toBe(
      'xnapify_schema_lock:app_one',
    );
    expect(second.calls[0].replacements.name).toBe(
      'xnapify_schema_lock:app_two',
    );
    expect(first.calls[1].replacements.name).toBe(
      first.calls[0].replacements.name,
    );
    expect(first.calls[0].replacements.name.length).toBeLessThanOrEqual(64);
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

describe('schema-mutating rollbacks', () => {
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

  it('holds the schema lock while reverting a migration', async () => {
    // Regression: runMigrations()/runSeeds() took the lock but the down()
    // paths, which mutate the schema just as much, did not.
    const connection = fakeConnection('postgres');
    await revertMigrations([fakeSource()], connection, { logger });

    // The outer transaction plus one SAVEPOINT for the idle-timeout guard.
    expect(connection.transaction).toHaveBeenCalledTimes(2);
    expect(sql(connection)).toContain('SELECT pg_advisory_xact_lock(:key)');
    expect(mockUmzug.down).toHaveBeenCalledTimes(1);
  });

  it('holds the schema lock while undoing a seed', async () => {
    const connection = fakeConnection('postgres');
    await undoSeeds([fakeSource()], connection, { logger });

    // The outer transaction plus one SAVEPOINT for the idle-timeout guard.
    expect(connection.transaction).toHaveBeenCalledTimes(2);
    expect(sql(connection)).toContain('SELECT pg_advisory_xact_lock(:key)');
    expect(mockUmzug.down).toHaveBeenCalledTimes(1);
  });
});
