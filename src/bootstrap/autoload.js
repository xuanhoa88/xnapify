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

const MODEL_PATH_PATTERN = /^\.\/([^/]+)\/models\/index\.(js|ts)$/;
const ROUTER_PATH_PATTERN = /^\.\/([^/]+)\/index\.(js|ts)$/;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Safely load a module factory from webpack context
 */
function loadFactory(context, path) {
  try {
    // Load module through webpack context
    const mod = context(path);

    // Handle both ES modules and CommonJS
    // ES modules: { __esModule: true, default: Function, ... }
    // CommonJS: Function or { exports: ... }
    // eslint-disable-next-line no-underscore-dangle
    const factory = mod.default || mod;

    // Validate factory is a function
    if (typeof factory !== 'function') {
      const actualType =
        factory === null
          ? 'null'
          : factory === undefined
            ? 'undefined'
            : Array.isArray(factory)
              ? 'array'
              : typeof factory;

      console.warn(`⚠️  ${path}: Expected function export, got ${actualType}`);
      return null;
    }

    // Additional validation: check if it's a valid factory
    // Factory should be a regular function or async function
    const isAsyncFunction = factory.constructor.name === 'AsyncFunction';
    const isRegularFunction = factory.constructor.name === 'Function';
    const isArrowFunction = !factory.prototype;

    if (!isAsyncFunction && !isRegularFunction && !isArrowFunction) {
      console.warn(`⚠️  ${path}: Export is not a valid function type`);
      return null;
    }

    return factory;
  } catch (error) {
    // Handle loading errors (syntax errors, missing files, etc.)
    const errorMsg = error.message || String(error);
    console.error(`❌ ${path}: Failed to load - ${errorMsg}`);

    // Log stack trace in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }

    return null;
  }
}

/**
 * Validate model result
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
 * Validate router result
 */
function validateRouter(result) {
  if (!result) {
    throw new Error('Factory returned null/undefined');
  }

  if (typeof result.use !== 'function') {
    throw new Error('Factory must return an Express Router');
  }

  return true;
}

// =============================================================================
// LOADERS
// =============================================================================

/**
 * Load all models in parallel
 */
async function loadModels(context, paths, app) {
  const db = app.get('db');
  const allModels = {};
  const errors = [];

  // Load all models in parallel
  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadFactory(context, path);
      if (!factory) {
        throw new Error('Failed to load factory');
      }

      const result = await factory(db, app);
      const names = validateModels(result, path);

      return { path, result, names };
    }),
  );

  // Process results
  let loaded = 0;
  for (let i = 0; i < results.length; i++) {
    const settled = results[i];
    const path = paths[i];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      continue;
    }

    const { result, names } = settled.value;

    // Check duplicates
    const duplicates = names.filter(name => name in allModels);
    if (duplicates.length > 0) {
      console.warn(
        `⚠️  ${path}: overwriting models [${duplicates.join(', ')}]`,
      );
    }

    Object.assign(allModels, result);
    loaded++;
    console.info(`✅ ${path}: loaded ${names.length} model(s)`);
  }

  // Store in app
  app.set('models', allModels);

  return {
    models: allModels,
    total: paths.length,
    loaded,
    failed: errors.length,
    errors,
  };
}

/**
 * Load all routers in parallel
 */
async function loadRouters(context, paths, app) {
  const mainRouter = Router();
  const errors = [];

  // Load all routers in parallel
  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadFactory(context, path);
      if (!factory) {
        throw new Error('Failed to load factory');
      }

      const result = await factory({ Router }, app);
      validateRouter(result, path);

      return { path, result };
    }),
  );

  // Process results and mount routers
  let loaded = 0;
  for (let i = 0; i < results.length; i++) {
    const settled = results[i];
    const path = paths[i];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      continue;
    }

    const { result } = settled.value;
    mainRouter.use(result);
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

/**
 * Print summary of loading results
 */
function printSummary(type, stats) {
  console.info(`📦 ${type}: ${stats.loaded}/${stats.total} loaded`);

  if (stats.errors.length > 0) {
    console.error(`\n❌ ${type} Errors:`);
    stats.errors.forEach(({ path, error }) => {
      console.error(`   ${path}: ${error}`);
    });
    console.error('');
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and load API modules with models and routers
 *
 * Compatible with webpack require.context for automatic module discovery.
 * Loads models first (in parallel), then routers (in parallel).
 *
 * @param {Object} app - Express app instance
 * @returns {Promise<{apiModels: Object, apiRoutes: Router}>}
 */
export async function discoverModules(app) {
  console.info('🔍 Discovering modules...\n');

  // Create webpack context - this will be replaced at build time
  const context = require.context('../modules', true, /\/index\.(js|ts)$/);

  // Get all module paths
  const allPaths = context.keys();
  const modelPaths = allPaths.filter(p => MODEL_PATH_PATTERN.test(p));
  const routerPaths = allPaths.filter(p => ROUTER_PATH_PATTERN.test(p));

  console.info(
    `Found ${modelPaths.length} models, ${routerPaths.length} routers\n`,
  );

  // Phase 1: Load models (parallel)
  const modelStats = await loadModels(context, modelPaths, app);
  printSummary('Models', modelStats);

  // Phase 2: Load routers (parallel)
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
