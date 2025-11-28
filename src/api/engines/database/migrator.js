/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import * as Sequelize from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';

/**
 * Load migrations using require.context (for bundled migrations)
 * This works in Webpack-bundled environments
 */
const builtInMigrationsContext = require.context(
  './migrations',
  false,
  /\.js$/,
);

/**
 * Load seeds using require.context (for bundled seeds)
 * This works in Webpack-bundled environments
 */
const builtInSeedsContext = require.context('./seeds', false, /\.js$/);

/**
 * Extract clean filename from require.context key
 *
 * @param {string} key - Original key from require.context
 * @returns {string} Clean filename without path or extension
 */
function extractFileName(key) {
  return key
    .replace(/\\/g, '/') // Normalize backslashes
    .split('/') // Split into segments
    .pop() // Get last segment (filename)
    .replace(/\.js$/, ''); // Remove extension
}

/**
 * Resolve absolute path from require.context
 *
 * @param {Function} context - Webpack require.context function
 * @param {string} key - Key from context.keys()
 * @returns {string} Absolute file path
 */
function resolveAbsolutePath(context, key) {
  // Method 1: Use context.resolve() if available (webpack provides this)
  if (typeof context.resolve === 'function') {
    try {
      return context.resolve(key);
    } catch {
      // Fall through to alternative methods
    }
  }

  // Method 2: Use require.resolve with context.id
  // context.id contains the base path
  if (context.id) {
    try {
      const basePath = context.id.split(' ')[0]; // Extract base path from context.id
      const normalizedKey = key.replace(/^\.\//, '');
      return path.resolve(basePath, normalizedKey);
    } catch {
      // Fall through
    }
  }

  // Method 3: Fallback to relative path if absolute path cannot be determined
  return key;
}

/**
 * Convert require.context to umzug migrations format
 * Automatically deduplicates by filename
 *
 * @param {Function} context - Webpack require.context function
 * @param {string} prefix - Module identifier to prevent name collisions (e.g., 'users', 'posts')
 * @returns {Array} Array of unique migration objects
 */
function contextToMigrations(context, prefix) {
  const allKeys = context.keys();
  const uniqueMigrations = new Map();

  allKeys.forEach(key => {
    const migration = context(key);
    const fileName = extractFileName(key);

    // Create unique name with module prefix
    const name = prefix ? `${prefix}/${fileName}` : fileName;

    // Keep first occurrence of each unique name
    if (!uniqueMigrations.has(name)) {
      uniqueMigrations.set(name, {
        name,
        path: resolveAbsolutePath(context, key), // Use absolute path
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
    throw new Error('migrationSources must be an array');
  }

  const allMigrations = new Map();

  migrationSources.forEach(source => {
    if (!source || typeof source !== 'object') {
      throw new Error(
        'Each migration source must be an object with {context, prefix}',
      );
    }

    if (!source.context || typeof source.context !== 'function') {
      throw new Error(
        'Each migration source must have a valid context (require.context function)',
      );
    }

    if (
      typeof source.prefix !== 'string' ||
      source.prefix.trim().length === 0
    ) {
      throw new Error(
        'Each migration source must have a valid prefix (string)',
      );
    }

    const migrations = contextToMigrations(source.context, source.prefix);

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
    throw new Error('Sequelize connection is required');
  }
  if (typeof connection.authenticate !== 'function') {
    throw new Error('Invalid Sequelize connection instance');
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
    migrationsConfig = contextToMigrations(builtInMigrationsContext);
  } else if (Array.isArray(migrations)) {
    // Array of {context, prefix} objects
    migrationsConfig = mergeMigrations(migrations);
  } else {
    throw new Error(
      'Invalid migrations parameter. Expected:\n' +
        '  - null (use built-in migrations)\n' +
        '  - [{context, prefix}, ...] (module migrations)',
    );
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
    seedsConfig = contextToMigrations(builtInSeedsContext);
  } else if (Array.isArray(seeds)) {
    // Array of {context, prefix} objects
    seedsConfig = mergeMigrations(seeds);
  } else {
    throw new Error(
      'Invalid seeds parameter. Expected:\n' +
        '  - null (use built-in seeds)\n' +
        '  - [{context, prefix}, ...] (module seeds)',
    );
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
