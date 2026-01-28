/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * API Module Autoloader
 *
 * Discovers and loads API modules (models + routers) from the modules directory.
 * Core modules (like 'users') are loaded first to ensure proper dependency order.
 */

import { Router } from 'express';
import { createContextAdapter } from '../context';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Pattern to match model index files: ./moduleName/api/models/index.js */
const MODEL_PATH_PATTERN = /^\.\/([^/]+)\/api\/models\/index\.[cm]?[jt]s$/;

/** Pattern to match router index files: ./moduleName/api/index.js */
const ROUTER_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/;

// =============================================================================
// CORE MODULES CONFIGURATION
// =============================================================================

/**
 * Parse additional core modules from environment variable.
 * Format: RSK_MODULE_DEFAULTS=admin,reports
 */
function parseEnvCoreModules() {
  const envValue = process.env.RSK_MODULE_DEFAULTS;
  if (!envValue || typeof envValue !== 'string') {
    return [];
  }

  return envValue
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
}

/**
 * Set of core modules that must be loaded.
 * 'users' is always required; additional modules come from RSK_MODULE_DEFAULTS.
 */
const CORE_MODULES = new Set(['users', ...parseEnvCoreModules()]);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract module name from file path using the given pattern.
 *
 * @param {string} filePath - Relative file path (e.g., './users/api/index.js')
 * @param {RegExp} pattern - Pattern with capture group for module name
 * @returns {string} Module name or 'unknown'
 */
function getModuleName(filePath, pattern) {
  const match = filePath.match(pattern);
  return (match && match[1]) || 'unknown';
}

/**
 * Load and validate a module's factory export.
 *
 * @param {object} adapter - Context adapter with load() method
 * @param {string} filePath - Path to load
 * @returns {Function} Factory function
 * @throws {Error} If module doesn't export a function
 */
function loadModuleFactory(adapter, filePath) {
  const mod = adapter.load(filePath);
  const factory = mod.default || mod;

  if (typeof factory !== 'function') {
    throw new Error(
      `Module must export a factory function, got ${typeof factory}`,
    );
  }

  return factory;
}

/**
 * Create a structured error object for logging.
 *
 * @param {string} moduleName - Name of the module
 * @param {string} filePath - Path to the module file
 * @param {Error} error - Original error
 * @returns {object} Structured error object
 */
function createLoadError(moduleName, filePath, error) {
  return {
    moduleName,
    path: filePath,
    message: error.message || String(error),
    stack: error.stack,
  };
}

// =============================================================================
// MODULE SORTING & VALIDATION
// =============================================================================

/**
 * Sort module paths with core modules first, then alphabetically.
 *
 * @param {string[]} modulePaths - Array of module file paths
 * @returns {string[]} Sorted paths
 */
export function sortModules(modulePaths) {
  // Build priority map: core modules get priority by their order in CORE_MODULES
  const corePriority = new Map(
    Array.from(CORE_MODULES).map((name, index) => [name, index]),
  );

  return [...modulePaths].sort((a, b) => {
    const nameA =
      getModuleName(a, ROUTER_PATH_PATTERN) ||
      getModuleName(a, MODEL_PATH_PATTERN);
    const nameB =
      getModuleName(b, ROUTER_PATH_PATTERN) ||
      getModuleName(b, MODEL_PATH_PATTERN);

    const priorityA = corePriority.has(nameA)
      ? corePriority.get(nameA)
      : Infinity;
    const priorityB = corePriority.has(nameB)
      ? corePriority.get(nameB)
      : Infinity;

    // Core modules come first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Then sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Validate that all core modules are present in the discovered paths.
 *
 * @param {string[]} modulePaths - Array of discovered module paths
 * @param {object} [options] - Options
 * @param {boolean} [options.strictCoreModules=true] - Throw on missing modules
 * @returns {{valid: boolean, missing: string[]}}
 * @throws {Error} If strict mode and core modules are missing
 */
export function validateCoreModules(modulePaths, options = {}) {
  const { strictCoreModules = true } = options;

  const foundModules = new Set(
    modulePaths
      .map(path => getModuleName(path, ROUTER_PATH_PATTERN))
      .filter(Boolean),
  );

  const missing = Array.from(CORE_MODULES).filter(
    name => !foundModules.has(name),
  );

  if (missing.length > 0) {
    const message = `Missing required core module(s): ${missing.join(', ')}`;

    if (strictCoreModules) {
      throw new Error(message);
    }

    console.warn(`⚠️ ${message}`);
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

// =============================================================================
// MODEL LOADING
// =============================================================================

/**
 * Load all model modules sequentially.
 *
 * @param {object} adapter - Context adapter
 * @param {string[]} paths - Sorted model file paths
 * @param {object} app - Express app instance
 * @returns {Promise<{models: object, errors: object[]}>}
 */
async function loadModels(adapter, paths, app) {
  const db = app.get('db');

  if (!db) {
    console.warn('⚠️ No database connection found, skipping models');
    return { models: {}, errors: [] };
  }

  const models = {};
  const errors = [];

  for (const filePath of paths) {
    const moduleName = getModuleName(filePath, MODEL_PATH_PATTERN);

    try {
      const factory = loadModuleFactory(adapter, filePath);
      const result = await factory(db, app);

      if (!result || typeof result !== 'object') {
        throw new Error(
          'Model factory must return an object containing models',
        );
      }

      const modelNames = Object.keys(result);
      if (modelNames.length === 0) {
        throw new Error('Model factory returned empty object');
      }

      // Check for duplicate model names
      const duplicates = modelNames.filter(name => name in models);
      if (duplicates.length > 0) {
        console.warn(
          `⚠️ [${moduleName}] Overwriting models: ${duplicates.join(', ')}`,
        );
      }

      Object.assign(models, result);
      console.info(
        `✅ [${moduleName}] Loaded ${modelNames.length} model(s): ${modelNames.join(', ')}`,
      );
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      console.error(`❌ [${moduleName}] ${error.message}`);
    }
  }

  return { models, errors };
}

// =============================================================================
// ROUTER LOADING
// =============================================================================

/**
 * Load all router modules sequentially.
 *
 * @param {object} adapter - Context adapter
 * @param {string[]} paths - Sorted router file paths
 * @param {object} app - Express app instance
 * @returns {Promise<{router: Router, errors: object[]}>}
 */
async function loadRouters(adapter, paths, app) {
  const mainRouter = Router();
  const errors = [];

  for (const filePath of paths) {
    const moduleName = getModuleName(filePath, ROUTER_PATH_PATTERN);

    try {
      const factory = loadModuleFactory(adapter, filePath);
      const router = await factory({ Router }, app);

      if (!router || typeof router.use !== 'function') {
        throw new Error(
          'Router factory must return an Express Router instance',
        );
      }

      mainRouter.use(router);
      console.info(`✅ [${moduleName}] Mounted router`);
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      console.error(`❌ [${moduleName}] ${error.message}`);
    }
  }

  return { router: mainRouter, errors };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and load API modules (models and routers).
 *
 * Scans the modules directory for model and router index files,
 * validates core modules are present, and loads them in order.
 *
 * @param {object} modulesContext - Webpack require.context or compatible
 * @param {object} app - Express app instance
 * @returns {Promise<{apiModels: object, apiRoutes: Router, errors: object[]}>}
 * @throws {Error} If Express app is missing or core modules fail to load
 */
export async function discoverModules(modulesContext, app) {
  if (!app) {
    throw new Error('Express app instance is required');
  }

  console.info('🔍 Discovering API modules...\n');

  const adapter = createContextAdapter(modulesContext);
  const allFiles = adapter.files();

  // Separate model and router files
  const modelPaths = allFiles.filter(path => MODEL_PATH_PATTERN.test(path));
  const routerPaths = allFiles.filter(path => ROUTER_PATH_PATTERN.test(path));

  console.info(
    `📦 Found ${modelPaths.length} model module(s), ${routerPaths.length} router module(s)\n`,
  );

  // Validate core modules are present
  const coreValidation = validateCoreModules(routerPaths);
  if (!coreValidation.valid) {
    throw new Error(
      `Core module validation failed: ${coreValidation.missing.join(', ')}`,
    );
  }

  // Sort to load core modules first
  const sortedModelPaths = sortModules(modelPaths);
  const sortedRouterPaths = sortModules(routerPaths);

  const startTime = Date.now();

  // Load models, then routers
  const { models, errors: modelErrors } = await loadModels(
    adapter,
    sortedModelPaths,
    app,
  );
  const { router, errors: routerErrors } = await loadRouters(
    adapter,
    sortedRouterPaths,
    app,
  );

  const duration = Date.now() - startTime;
  const allErrors = [...modelErrors, ...routerErrors];

  // Summary
  console.info('\n📊 Loading Summary:');
  console.info(
    `   Models:  ${Object.keys(models).length} loaded from ${sortedModelPaths.length} module(s)`,
  );
  console.info(`   Routers: ${sortedRouterPaths.length} mounted`);
  console.info(`   Duration: ${duration}ms`);

  if (allErrors.length > 0) {
    console.warn(`   Errors:  ${allErrors.length}`);
  }

  // Fail if any core module failed to load
  const failedCoreModules = allErrors
    .filter(error => CORE_MODULES.has(error.moduleName))
    .map(error => error.moduleName);

  if (failedCoreModules.length > 0) {
    throw new Error(
      `Failed to load core modules: ${failedCoreModules.join(', ')}. Application cannot start.`,
    );
  }

  console.info(
    allErrors.length === 0
      ? '\n✨ All modules loaded successfully\n'
      : '\n⚠️ Some modules failed to load. Check errors above.\n',
  );

  return {
    apiModels: models,
    apiRoutes: router,
    errors: allErrors,
  };
}
