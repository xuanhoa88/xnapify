/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as Sequelize from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';

import { createRspackContextAdapter } from '@shared/utils/contextAdapter.js';

// ======================================================================
// Internal helpers
// ======================================================================

/**
 * Extract filename from import.meta.webpackContext key: './filename.js' -> 'filename'
 *
 * @param {string} key - Rspack context key (e.g. './2026.01.12T00.00.00.create-users.js')
 * @returns {string} Filename without extension
 */
function extractFileName(key) {
  return key
    .replace(/\\/g, '/') // Normalize backslashes
    .split('/') // Split into segments
    .pop() // Get last segment (filename)
    .replace(/\.[cm]?[jt]s$/i, ''); // Remove extension
}

/**
 * Resolve absolute path from context adapter.
 *
 * @param {Object} adapter - Context adapter
 * @param {string} key - Module key
 * @returns {string} Resolved path (absolute if possible, otherwise relative)
 */
function resolveAbsolutePath(adapter, key) {
  if (typeof adapter.resolve === 'function') {
    try {
      return adapter.resolve(key);
    } catch (_err) {
      // adapter.resolve() unavailable — fall through to relative path
    }
  }

  return key;
}

/**
 * Convert context adapter to umzug migrations (auto-deduplicated by filename).
 *
 * Throws if a migration file does not export a valid `up` function, preventing
 * silent no-ops from being recorded as "executed" in the storage table.
 *
 * @param {Object} adapter - Context adapter
 * @param {string} [prefix] - Module prefix
 * @param {Object} [options] - Optional configuration
 * @returns {Array} Array of migration objects
 */
function adapterToMigrations(adapter, prefix, options = {}) {
  const allKeys = adapter.files();
  const uniqueMigrations = new Map();

  allKeys.forEach(key => {
    const migration = adapter.load(key);
    const fileName = extractFileName(key);

    // Create unique name with module prefix
    const name = prefix ? `${prefix}/${fileName}` : fileName;

    // Keep first occurrence of each unique name
    if (!uniqueMigrations.has(name)) {
      // Validate: every migration MUST export a valid `up` function
      if (typeof migration.up !== 'function') {
        const error = new Error(
          `Migration "${name}" does not export a valid "up" function`,
        );
        error.name = 'InvalidMigrationError';
        error.status = 400;
        throw error;
      }

      uniqueMigrations.set(name, {
        name,
        path: resolveAbsolutePath(adapter, key),
        up: async ({ context }) =>
          migration.up({ name, context, Sequelize }, options),
        down: async ({ context }) =>
          typeof migration.down === 'function' &&
          (await migration.down({ name, context, Sequelize }, options)),
      });
    }
  });

  return Array.from(uniqueMigrations.values());
}

/**
 * Merge multiple migration sources into a single array.
 * Ensures no duplicate names across modules.
 *
 * @param {Array} migrationSources - Array of {context, prefix} objects
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance (default: console)
 * @returns {Array} Combined array of migration objects
 */
function mergeMigrations(migrationSources, options = {}) {
  if (!Array.isArray(migrationSources)) {
    const error = new Error('migrationSources must be an array');
    error.name = 'InvalidMigrationSourcesError';
    error.status = 400;
    throw error;
  }

  const logger = options.logger || console;

  const allMigrations = new Map();

  migrationSources.forEach(source => {
    if (!source || typeof source !== 'object') {
      const error = new Error(
        'Each migration source must be an object with {context, prefix}',
      );
      error.name = 'InvalidMigrationSourceError';
      error.status = 400;
      throw error;
    }

    if (!source.context || typeof source.context !== 'function') {
      const error = new Error(
        'Each migration source must have a valid context (rspack import.meta.webpackContext function)',
      );
      error.name = 'InvalidMigrationSourceContextError';
      error.status = 400;
      throw error;
    }

    if (
      typeof source.prefix !== 'string' ||
      source.prefix.trim().length === 0
    ) {
      const error = new Error(
        'Each migration source must have a valid prefix (string)',
      );
      error.name = 'InvalidMigrationSourcePrefixError';
      error.status = 400;
      throw error;
    }

    // Wrap raw context with adapter
    const adapter = createRspackContextAdapter(source.context);
    const migrations = adapterToMigrations(adapter, source.prefix, options);

    migrations.forEach(migration => {
      if (allMigrations.has(migration.name)) {
        logger.warn(
          `⚠️  Duplicate migration name detected: ${migration.name}. Using first occurrence.`,
        );
      } else {
        allMigrations.set(migration.name, migration);
      }
    });
  });

  return Array.from(allMigrations.values());
}

/**
 * Validate that a Sequelize connection instance is valid.
 *
 * @param {Sequelize} connection - Sequelize connection instance
 * @throws {Error} If connection is not provided or invalid
 */
function validateConnection(connection) {
  if (!connection) {
    const error = new Error('Sequelize connection is required');
    error.name = 'InvalidConnectionError';
    error.status = 400;
    throw error;
  }
  if (typeof connection.authenticate !== 'function') {
    const error = new Error('Invalid Sequelize connection instance');
    error.name = 'InvalidConnectionError';
    error.status = 400;
    throw error;
  }
}

// ======================================================================
// Umzug factory functions
// ======================================================================

/**
 * Create migration umzug instance
 *
 * @param {Array} migrations - Migration sources: [{context, prefix}, ...] from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance (default: console)
 * @returns {Umzug} Configured Umzug instance for migrations
 */
function createMigrationUmzug(migrations, connection, options = {}) {
  validateConnection(connection);

  const logger = options.logger || console;

  if (!Array.isArray(migrations)) {
    const error = new Error(
      'Invalid migrations parameter. Expected [{context, prefix}, ...]',
    );
    error.name = 'InvalidMigrationsError';
    error.status = 400;
    throw error;
  }

  const migrationsConfig = mergeMigrations(migrations, options);

  return new Umzug({
    migrations: migrationsConfig,
    context: connection,
    storage: new SequelizeStorage({
      sequelize: connection,
      modelName: 'sequelize_migrations',
    }),
    logger,
  });
}

/**
 * Create seed umzug instance
 *
 * @param {Array} seeds - Seed sources: [{context, prefix}, ...] from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance (default: console)
 * @returns {Umzug} Configured Umzug instance for seeds
 */
function createSeedUmzug(seeds, connection, options = {}) {
  validateConnection(connection);

  const logger = options.logger || console;

  if (!Array.isArray(seeds)) {
    const error = new Error(
      'Invalid seeds parameter. Expected [{context, prefix}, ...]',
    );
    error.name = 'InvalidSeedsError';
    error.status = 400;
    throw error;
  }

  const seedsConfig = mergeMigrations(seeds, options);

  return new Umzug({
    migrations: seedsConfig,
    context: connection,
    storage: new SequelizeStorage({
      sequelize: connection,
      modelName: 'sequelize_seeds',
    }),
    logger,
  });
}

// ======================================================================
// Cross-process lock
// ======================================================================

/** Arbitrary but stable 32-bit key for the Postgres advisory lock ('xnap') */
const PG_LOCK_KEY = 0x786e6170;
/** Named lock for MySQL/MariaDB GET_LOCK */
const MYSQL_LOCK_NAME = 'xnapify_schema_lock';

/**
 * Run `fn` while holding a database-level lock so that only one process
 * applies migrations or seeds at a time. Every cluster worker (and every
 * replica behind a load balancer) runs the migration phase at boot; without
 * this they race on `sequelize_migrations` and can apply the same file twice.
 *
 *   - Postgres: transaction-scoped advisory lock (released on commit/rollback)
 *   - MySQL/MariaDB: GET_LOCK / RELEASE_LOCK on a pinned connection
 *   - SQLite and others: no-op (SQLite serialises writers by itself)
 *
 * The lock is held on one pooled connection while the work runs on others,
 * so it is skipped (with a warning) when the pool cannot hold two.
 *
 * @param {Sequelize} connection
 * @param {() => Promise<*>} fn
 * @param {Object} [options]
 * @param {Console} [options.logger]
 * @param {number} [options.timeoutSeconds=300] - MySQL wait timeout
 * @returns {Promise<*>} Result of fn
 */
export async function withSchemaLock(connection, fn, options = {}) {
  const logger = options.logger || console;
  const timeoutSeconds = options.timeoutSeconds || 300;
  const dialect =
    typeof connection.getDialect === 'function' ? connection.getDialect() : '';
  const poolMax =
    connection.options && connection.options.pool
      ? Number(connection.options.pool.max)
      : NaN;

  const lockable =
    dialect === 'postgres' || dialect === 'mysql' || dialect === 'mariadb';
  if (!lockable) return fn();

  if (Number.isFinite(poolMax) && poolMax < 2) {
    logger.warn(
      '⚠️  Schema lock skipped: the connection pool must allow at least 2 connections',
    );
    return fn();
  }

  return connection.transaction(async transaction => {
    if (dialect === 'postgres') {
      await connection.query('SELECT pg_advisory_xact_lock(:key)', {
        replacements: { key: PG_LOCK_KEY },
        transaction,
      });
      return fn();
    }

    const [rows] = await connection.query(
      'SELECT GET_LOCK(:name, :timeout) AS acquired',
      {
        replacements: { name: MYSQL_LOCK_NAME, timeout: timeoutSeconds },
        transaction,
      },
    );
    const acquired = rows && rows[0] && Number(rows[0].acquired) === 1;
    if (!acquired) {
      const error = new Error(
        `Could not acquire schema lock within ${timeoutSeconds}s`,
      );
      error.name = 'SchemaLockTimeoutError';
      error.code = 'SCHEMA_LOCK_TIMEOUT';
      throw error;
    }
    try {
      return await fn();
    } finally {
      await connection.query('SELECT RELEASE_LOCK(:name)', {
        replacements: { name: MYSQL_LOCK_NAME },
        transaction,
      });
    }
  });
}

// ======================================================================
// Public API
// ======================================================================

/**
 * Get migration status
 *
 * @param {Array} migrations - Migration sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<{executed: Array, pending: Array}>} Migration status
 */
export async function getMigrationStatus(migrations, connection, options = {}) {
  const umzug = createMigrationUmzug(migrations, connection, options);
  const [executed, pending] = await Promise.all([
    umzug.executed(),
    umzug.pending(),
  ]);

  return {
    executed: executed.map(m => m.name),
    pending: pending.map(m => m.name),
  };
}

/**
 * Get seed status
 *
 * @param {Array} seeds - Seed sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<{executed: Array, pending: Array}>} Seed status
 */
export async function getSeedStatus(seeds, connection, options = {}) {
  const umzug = createSeedUmzug(seeds, connection, options);
  const [executed, pending] = await Promise.all([
    umzug.executed(),
    umzug.pending(),
  ]);

  return {
    executed: executed.map(s => s.name),
    pending: pending.map(s => s.name),
  };
}

/**
 * Run pending migrations
 *
 * @param {Array} migrations - Migration sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function runMigrations(migrations, connection, options = {}) {
  const logger = options.logger || console;

  try {
    const umzug = createMigrationUmzug(migrations, connection, {
      ...options,
      logger,
    });
    // Re-read pending inside the lock: another process may have just applied them
    await withSchemaLock(
      connection,
      async () => {
        const pending = await umzug.pending();

        if (pending.length > 0) {
          logger.log(
            `⚙️  Pending migrations:`,
            pending.map(m => m.name),
          );
          await umzug.up();
          logger.log('✅ Migrations executed successfully');
        } else {
          logger.log(`✅ Database is up to date`);
        }
      },
      { logger },
    );
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Run seeds
 *
 * @param {Array} seeds - Seed sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function runSeeds(seeds, connection, options = {}) {
  const logger = options.logger || console;

  try {
    const umzug = createSeedUmzug(seeds, connection, {
      ...options,
      logger,
    });
    await withSchemaLock(
      connection,
      async () => {
        const pending = await umzug.pending();

        if (pending.length > 0) {
          logger.log(
            `🌱 Pending seeds:`,
            pending.map(s => s.name),
          );
          await umzug.up();
          logger.log('✅ Seeds executed successfully');
        } else {
          logger.log(`✅ No pending seeds`);
        }
      },
      { logger },
    );
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Revert last migration
 *
 * @param {Array} migrations - Migration sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function revertMigrations(migrations, connection, options = {}) {
  const logger = options.logger || console;

  try {
    const umzug = createMigrationUmzug(migrations, connection, {
      ...options,
      logger,
    });
    const executed = await umzug.executed();

    if (executed.length === 0) {
      logger.log('⚠️  No migrations to revert');
      return;
    }

    const [reverted] = await umzug.down();
    logger.log(`✅ Reverted migration: ${reverted.name}`);
  } catch (error) {
    logger.error('❌ Revert failed:', error);
    throw error;
  }
}

/**
 * Undo last seed
 *
 * @param {Array} seeds - Seed sources from modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function undoSeeds(seeds, connection, options = {}) {
  const logger = options.logger || console;

  try {
    const umzug = createSeedUmzug(seeds, connection, {
      ...options,
      logger,
    });
    const executed = await umzug.executed();

    if (executed.length === 0) {
      logger.log('⚠️  No seeds to undo');
      return;
    }

    const [reverted] = await umzug.down();
    logger.log(`✅ Undo seed: ${reverted.name}`);
  } catch (error) {
    logger.error('❌ Failed to undo seed:', error);
    throw error;
  }
}
