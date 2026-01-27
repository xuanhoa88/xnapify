/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import { createContextAdapter } from '../context';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL_PATH_PATTERN = /^\.\/([^/]+)\/api\/models\/index\.[cm]?[jt]s$/;
const ROUTER_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/;

// =============================================================================
// CORE LOADERS
// =============================================================================

/**
 * Load and validate a module factory
 */
function loadModule(adapter, filePath) {
  const mod = adapter.load(filePath);
  const factory = mod.default || mod;

  if (typeof factory !== 'function') {
    throw new Error(`Expected function export, got ${typeof factory}`);
  }

  return factory;
}

/**
 * Load all models in parallel
 */
export async function loadModels(adapter, paths, app) {
  const db = app.get('db');
  if (!db) {
    console.warn('⚠️  No database connection found, skipping models');
    return { models: {}, stats: { total: 0, loaded: 0, failed: 0 } };
  }

  const models = {};
  const errors = [];

  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadModule(adapter, path);
      const result = await factory(db, app);

      if (!result || typeof result !== 'object') {
        throw new Error('Factory must return an object');
      }

      const names = Object.keys(result);
      if (names.length === 0) {
        throw new Error('Factory returned empty object');
      }

      return { path, result, names };
    }),
  );

  results.forEach((settled, index) => {
    const path = paths[index];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      console.error(`❌ ${path}: ${settled.reason.message}`);
      return;
    }

    const { result, names } = settled.value;

    // Check for duplicates
    const duplicates = names.filter(name => name in models);
    if (duplicates.length > 0) {
      console.warn(`⚠️  ${path}: overwriting [${duplicates.join(', ')}]`);
    }

    Object.assign(models, result);
    console.info(`✅ ${path}: loaded ${names.length} model(s)`);
  });

  const loaded = results.filter(r => r.status === 'fulfilled').length;

  return {
    models,
    stats: { total: paths.length, loaded, failed: errors.length },
  };
}

/**
 * Load all routers in parallel
 */
async function loadRouters(adapter, paths, app) {
  const mainRouter = Router();
  const errors = [];

  const results = await Promise.allSettled(
    paths.map(async path => {
      const factory = loadModule(adapter, path);
      const router = await factory({ Router }, app);

      if (!router || typeof router.use !== 'function') {
        throw new Error('Factory must return an Express Router');
      }

      return { path, router };
    }),
  );

  results.forEach((settled, index) => {
    const path = paths[index];

    if (settled.status === 'rejected') {
      errors.push({ path, error: settled.reason.message });
      console.error(`❌ ${path}: ${settled.reason.message}`);
      return;
    }

    mainRouter.use(settled.value.router);
    console.info(`✅ ${path}: mounted router`);
  });

  const loaded = results.filter(r => r.status === 'fulfilled').length;

  return {
    router: mainRouter,
    stats: { total: paths.length, loaded, failed: errors.length },
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and load API modules with models and routers
 */
export async function discoverModules(modulesAdapter, app) {
  if (!app) {
    throw new Error('Express app instance is required');
  }

  console.info('🔍 Discovering modules...\n');

  const adapter = createContextAdapter(modulesAdapter);
  const filePaths = adapter.files();

  const modelPaths = filePaths.filter(p => MODEL_PATH_PATTERN.test(p));
  const routerPaths = filePaths.filter(p => ROUTER_PATH_PATTERN.test(p));

  console.info(
    `📦 Found ${modelPaths.length} models, ${routerPaths.length} routers\n`,
  );

  // Load models and routers
  const { models, stats: modelStats } = await loadModels(
    adapter,
    modelPaths,
    app,
  );
  const { router, stats: routerStats } = await loadRouters(
    adapter,
    routerPaths,
    app,
  );

  // Summary
  console.info(`📊 Models: ${modelStats.loaded}/${modelStats.total} loaded`);
  console.info(`📊 Routers: ${routerStats.loaded}/${routerStats.total} loaded`);

  const allSuccess = modelStats.failed === 0 && routerStats.failed === 0;
  console.info(
    allSuccess
      ? '✨ All modules loaded successfully\n'
      : '⚠️  Some modules failed to load\n',
  );

  return {
    apiModels: models,
    apiRoutes: router,
  };
}
