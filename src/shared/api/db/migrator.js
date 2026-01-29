/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as Sequelize from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { createContextAdapter } from '../../context';

// Auto-load migrations via require.context
const migrationsContext = require.context(
  './migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load seeds via require.context
const seedsContext = require.context('./seeds', false, /\.[cm]?[jt]s$/i);

/**
 * Extract filename from require.context key: './filename.js' -> 'filename'
 */
function extractFileName(key) {
  return key
    .replace(/\\/g, '/') // Normalize backslashes
    .split('/') // Split into segments
    .pop() // Get last segment (filename)
    .replace(/\.[cm]?[jt]s$/i, ''); // Remove extension
}

/**
 * Resolve absolute path from context adapter
 */
function resolveAbsolutePath(adapter, key) {
  // Method 1: Use adapter.resolve() if available
  if (typeof adapter.resolve === 'function') {
    try {
      return adapter.resolve(key);
    } catch {
      // Fall through to alternative methods
    }
  }

  // Method 2: Fallback to relative path if absolute path cannot be determined
  return key;
}

/**
 * Convert context adapter to umzug migrations (auto-deduplicated by filename)
 */
function adapterToMigrations(adapter, prefix) {
  const allKeys = adapter.files();
  const uniqueMigrations = new Map();

  allKeys.forEach(key => {
    const migration = adapter.load(key);
    const fileName = extractFileName(key);

    // Create unique name with module prefix
    const name = prefix ? `${prefix}/${fileName}` : fileName;

    // Keep first occurrence of each unique name
    if (!uniqueMigrations.has(name)) {
      uniqueMigrations.set(name, {
        name,
        path: resolveAbsolutePath(adapter, key), // Use absolute path
        up: async ({ context }) =>
          typeof migration.up === 'function' &&
          (await migration.up({ name, context, Sequelize })),
        down: async ({ context }) =>
          typeof migration.down === 'function' &&
          (await migration.down({ name, context, Sequelize })),
      });
    }
  });

  return Array.from(uniqueMigrations.values());
}

/**
 * Merge multiple migration sources into a single array
 * Ensures no duplicate names across modules
 *
 * @param {Array} migrationSources - Array of {context, prefix} objects
 * @returns {Array} Combined array of migration objects
 */
function mergeMigrations(migrationSources) {
  if (!Array.isArray(migrationSources)) {
    const error = new Error('migrationSources must be an array');
    error.name = 'InvalidMigrationSourcesError';
    error.status = 400;
    throw error;
  }

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
        'Each migration source must have a valid context (webpack require.context function)',
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
    const adapter = createContextAdapter(source.context);
    const migrations = adapterToMigrations(adapter, source.prefix);

    migrations.forEach(migration => {
      if (allMigrations.has(migration.name)) {
        console.warn(
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
 * Validate required parameters
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

/**
 * Create migration umzug instance
 *
 * @param {Array|null} migrations - Migration source:
 *   - null: use built-in migrations
 *   - Array: [{context, prefix}, ...] for modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Console|Object} logger - Logger instance (default: console)
 * @returns {Umzug} Configured Umzug instance for migrations
 */
function createMigrationUmzug(migrations, connection, logger = console) {
  validateConnection(connection);

  let migrationsConfig;

  if (migrations == null) {
    // Use built-in bundled migrations
    const adapter = createContextAdapter(migrationsContext);
    migrationsConfig = adapterToMigrations(adapter);
  } else if (Array.isArray(migrations)) {
    // Array of {context, prefix} objects
    migrationsConfig = mergeMigrations(migrations);
  } else {
    const error = new Error(
      'Invalid migrations parameter. Expected:\n' +
        '  - null (use built-in migrations)\n' +
        '  - [{context, prefix}, ...] (module migrations)',
    );
    error.name = 'InvalidMigrationsError';
    error.status = 400;
    throw error;
  }

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
 * @param {Array|null} seeds - Seed source:
 *   - null: use built-in seeds
 *   - Array: [{context, prefix}, ...] for modules
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Console|Object} logger - Logger instance (default: console)
 * @returns {Umzug} Configured Umzug instance for seeds
 */
function createSeedUmzug(seeds, connection, logger = console) {
  validateConnection(connection);

  let seedsConfig;

  if (seeds == null) {
    // Use built-in bundled seeds
    const adapter = createContextAdapter(seedsContext);
    seedsConfig = adapterToMigrations(adapter);
  } else if (Array.isArray(seeds)) {
    // Array of {context, prefix} objects
    seedsConfig = mergeMigrations(seeds);
  } else {
    const error = new Error(
      'Invalid seeds parameter. Expected:\n' +
        '  - null (use built-in seeds)\n' +
        '  - [{context, prefix}, ...] (module seeds)',
    );
    error.name = 'InvalidSeedsError';
    error.status = 400;
    throw error;
  }

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

/**
 * Get migration status
 *
 * @param {Array|null} [migrations=null] - Migration source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<{executed: Array, pending: Array}>} Migration status
 */
export async function getMigrationStatus(
  migrations = null,
  connection,
  options = {},
) {
  validateConnection(connection);

  const umzug = createMigrationUmzug(
    migrations,
    connection,
    options.logger || console,
  );
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
 * @param {Array|null} [seeds=null] - Seed source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<{executed: Array, pending: Array}>} Seed status
 */
export async function getSeedStatus(seeds = null, connection, options = {}) {
  validateConnection(connection);

  const umzug = createSeedUmzug(seeds, connection, options.logger || console);
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
 * @param {Array|null} [migrations=null] - Migration source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function runMigrations(
  migrations = null,
  connection,
  options = {},
) {
  validateConnection(connection);

  const logger = options.logger || console;

  try {
    const umzug = createMigrationUmzug(migrations, connection, logger);
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
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Run seeds
 *
 * @param {Array|null} [seeds=null] - Seed source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function runSeeds(seeds = null, connection, options = {}) {
  validateConnection(connection);

  const logger = options.logger || console;

  try {
    const umzug = createSeedUmzug(seeds, connection, logger);
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
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Revert last migration
 *
 * @param {Array|null} [migrations=null] - Migration source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function revertMigration(
  migrations = null,
  connection,
  options = {},
) {
  validateConnection(connection);

  const logger = options.logger || console;

  try {
    const umzug = createMigrationUmzug(migrations, connection, logger);
    const executed = await umzug.executed();

    if (executed.length === 0) {
      logger.log('⚠️  No migrations to revert');
      return;
    }

    await umzug.down();
    logger.log(`✅ Reverted migration: ${executed[executed.length - 1].name}`);
  } catch (error) {
    logger.error('❌ Revert failed:', error);
    throw error;
  }
}

/**
 * Undo last seed
 *
 * @param {Array|null} [seeds=null] - Seed source
 * @param {Sequelize} connection - Sequelize connection instance
 * @param {Object} [options] - Optional configuration
 * @param {Console|Object} [options.logger] - Logger instance
 * @returns {Promise<void>}
 */
export async function undoSeed(seeds = null, connection, options = {}) {
  validateConnection(connection);

  const logger = options.logger || console;

  try {
    const umzug = createSeedUmzug(seeds, connection, logger);
    const executed = await umzug.executed();

    if (executed.length === 0) {
      logger.log('⚠️  No seeds to undo');
      return;
    }

    await umzug.down();
    logger.log(`✅ Undo seed: ${executed[executed.length - 1].name}`);
  } catch (error) {
    logger.error('❌ Failed to undo seed:', error);
    throw error;
  }
}
