/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL_PATH_PATTERN = /^\.\/([^/]+)\/api\/models\/index\.[cm]?[jt]s$/;
const ROUTER_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Safely load a module factory from webpack context
 * @param {Object} context - Webpack require.context
 * @param {string} path - Module path
 * @returns {Function|null} Factory function or null if failed
 */
function loadFactory(context, path) {
  try {
    const mod = context(path);
    const factory = mod.default || mod;

    if (typeof factory !== 'function') {
      console.warn(
        `⚠️  ${path}: Expected function export, got ${typeof factory}`,
      );
      return null;
    }

    return factory;
  } catch (error) {
    console.error(`❌ ${path}: Failed to load - ${error.message}`);
    return null;
  }
}

/**
 * Validate model factory result
 * @param {Object} result - Factory result
 * @returns {string[]} Model names
 */
function validateModels(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Factory must return an object');
  }

  const names = Object.keys(result);
  if (names.length === 0) {
    throw new Error('Factory returned empty object');
  }

  return names;
}

/**
 * Print loading summary
 * @param {string} type - Type name (Models/Routers)
 * @param {Object} stats - Loading stats
 */
function printSummary(type, stats) {
  console.info(`📦 ${type}: ${stats.loaded}/${stats.total} loaded`);

  if (stats.errors.length > 0) {
    console.error(`\n❌ ${type} Errors:`);
    stats.errors.forEach(({ path, error }) => {
      console.error(`   ${path}: ${error}`);
    });
  }
}

// =============================================================================
// LOADERS
// =============================================================================

/**
 * Load all models in parallel
 *
 * @param {Object} context - Webpack require.context
 * @param {string[]} paths - Model paths to load
 * @param {Object} db - Sequelize connection
 * @param {Object} [app] - Express app (optional, passed to factory)
 * @returns {Promise<{models: Object, total: number, loaded: number, failed: number, errors: Array}>}
 */
export async function loadModels(context, paths, db, app) {
  const models = {};
  const errors = [];

  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadFactory(context, path);
      if (!factory) {
        throw new Error('Failed to load factory');
      }

      const result = await factory(db, app);
      const names = validateModels(result);

      return { path, result, names };
    }),
  );

  let loaded = 0;
  for (let i = 0; i < results.length; i++) {
    const settled = results[i];
    const path = paths[i];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      continue;
    }

    const { result, names } = settled.value;

    // Warn on duplicate model names
    const duplicates = names.filter(name => name in models);
    if (duplicates.length > 0) {
      console.warn(
        `⚠️  ${path}: overwriting models [${duplicates.join(', ')}]`,
      );
    }

    Object.assign(models, result);
    loaded++;
    console.info(`✅ ${path}: loaded ${names.length} model(s)`);
  }

  return { models, total: paths.length, loaded, failed: errors.length, errors };
}

/**
 * Load all routers in parallel
 *
 * @param {Object} context - Webpack require.context
 * @param {string[]} paths - Router paths to load
 * @param {Object} app - Express app
 * @returns {Promise<{router: Router, total: number, loaded: number, failed: number, errors: Array}>}
 */
async function loadRouters(context, paths, app) {
  const mainRouter = Router();
  const errors = [];

  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadFactory(context, path);
      if (!factory) {
        throw new Error('Failed to load factory');
      }

      const result = await factory({ Router }, app);

      if (!result || typeof result.use !== 'function') {
        throw new Error('Factory must return an Express Router');
      }

      return { path, result };
    }),
  );

  let loaded = 0;
  for (let i = 0; i < results.length; i++) {
    const settled = results[i];
    const path = paths[i];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      continue;
    }

    mainRouter.use(settled.value.result);
    loaded++;
    console.info(`✅ ${path}: mounted router`);
  }

  return {
    router: mainRouter,
    total: paths.length,
    loaded,
    failed: errors.length,
    errors,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and load API modules with models and routers
 *
 * @param {Object} context - Webpack require.context
 * @param {Object} app - Express app instance
 * @returns {Promise<{apiModels: Object, apiRoutes: Router}>}
 */
export async function discoverModules(context, app) {
  console.info('🔍 Discovering modules...\n');

  const db = app.get('db');
  if (!db) {
    throw new Error('Database connection required (app.get("db"))');
  }

  const allPaths = context.keys();
  const modelPaths = allPaths.filter(p => MODEL_PATH_PATTERN.test(p));
  const routerPaths = allPaths.filter(p => ROUTER_PATH_PATTERN.test(p));

  console.info(
    `Found ${modelPaths.length} models, ${routerPaths.length} routers\n`,
  );

  // Phase 1: Load models
  const modelStats = await loadModels(context, modelPaths, db, app);
  printSummary('Models', modelStats);

  // Phase 2: Load routers
  const routerStats = await loadRouters(context, routerPaths, app);
  printSummary('Routers', routerStats);

  // Summary
  const allSuccess = modelStats.failed === 0 && routerStats.failed === 0;
  console.info(
    allSuccess
      ? '✨ All modules loaded successfully\n'
      : '⚠️  Some modules failed to load\n',
  );

  return {
    apiModels: modelStats.models,
    apiRoutes: routerStats.router,
  };
}
