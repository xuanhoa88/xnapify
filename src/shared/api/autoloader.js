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

/** Pattern to match model files: ./moduleName/api/models/ModelName.js */
const MODEL_PATH_PATTERN = /^\.\/([^/]+)\/api\/models\/[^/]+\.[cm]?[jt]s$/i;

/** Pattern to match module lifecycle files: ./moduleName/api/index.js */
const LIFECYCLE_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/i;

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
    const err = new Error(
      `Module must export a factory function, got ${typeof factory}`,
    );
    err.name = 'InvalidModuleError';
    err.code = 'INVALID_MODULE';
    throw err;
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
      getModuleName(a, LIFECYCLE_PATH_PATTERN) ||
      getModuleName(a, MODEL_PATH_PATTERN);
    const nameB =
      getModuleName(b, LIFECYCLE_PATH_PATTERN) ||
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
      .map(path => getModuleName(path, LIFECYCLE_PATH_PATTERN))
      .filter(Boolean),
  );

  const missing = Array.from(CORE_MODULES).filter(
    name => !foundModules.has(name),
  );

  if (missing.length > 0) {
    const message = `Missing required core module(s): ${missing.join(', ')}`;

    if (strictCoreModules) {
      const error = new Error(message);
      error.name = 'MissingCoreModulesError';
      error.code = 'MISSING_CORE_MODULES';
      throw error;
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
 * Load all model modules directly from file paths.
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
    const fileName = filePath.split('/').pop();

    // Skip index files and test/spec files
    if (
      /^index\.[cm]?[jt]s$/i.test(fileName) ||
      /\.(test|spec)\.[cm]?[jt]s$/i.test(fileName)
    ) {
      continue;
    }

    const moduleName = getModuleName(filePath, MODEL_PATH_PATTERN);

    try {
      const factory = loadModuleFactory(adapter, filePath);
      const model = await factory(db, app);

      // Validate model exists and has basic properties
      if (!model) {
        console.warn(
          `⚠️ [${moduleName}] File "${filePath}" did not return a valid object.`,
        );
        continue;
      }

      if (!model.name) {
        console.warn(
          `⚠️ [${moduleName}] File "${filePath}" returned an object without a name property.`,
        );
        continue;
      }

      // Validate it's a Sequelize model
      if (
        typeof model.findAll !== 'function' ||
        typeof model.create !== 'function'
      ) {
        console.warn(
          `⚠️ [${moduleName}] Model "${model.name}" doesn't appear to be a Sequelize model (missing findAll/create methods).`,
        );
        continue;
      }

      // Check for duplicate model names
      if (model.name in models) {
        const error = new Error(
          `Duplicate model name: "${model.name}". Module skipped.`,
        );
        errors.push(createLoadError(moduleName, filePath, error));
        console.error(`❌ [${moduleName}] ${error.message}`);
        continue;
      }

      models[model.name] = model;
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      console.error(`❌ [${moduleName}] ${error.message}`);
    }
  }

  // Initialize associations after all models are loaded
  Object.keys(models).forEach(modelName => {
    if (
      models[modelName] &&
      typeof models[modelName].associate === 'function'
    ) {
      try {
        models[modelName].associate(models);
        console.log(`🔗 [${modelName}] Associations initialized`);
      } catch (error) {
        errors.push(
          createLoadError(modelName, `${modelName}.associate(models)`, error),
        );
        console.error(
          `❌ [${modelName}] Failed to initialize associations: ${error.message}`,
        );
      }
    }
  });

  return { models, errors };
}

// =============================================================================
// LIFECYCLE MANAGEMENT
// =============================================================================

/**
 * Load all lifecycle modules.
 *
 * @param {object} adapter - Context adapter
 * @param {string[]} paths - Sorted lifecycle file paths
 * @returns {Promise<{lifecycles: Map, errors: object[]}>}
 */
async function loadModules(adapter, paths) {
  const lifecycles = new Map();
  const errors = [];

  for (const filePath of paths) {
    const moduleName = getModuleName(filePath, LIFECYCLE_PATH_PATTERN);

    try {
      // Direct load (supports object { install, uninstall, init } export)
      const hooks = adapter.load(filePath);

      if (!hooks || typeof hooks !== 'object') {
        const err = new Error(
          'Lifecycle module must export an object with lifecycle hooks',
        );
        err.name = 'InvalidLifecycleError';
        err.code = 'INVALID_LIFECYCLE';
        throw err;
      }

      // Validate at least one hook exists
      const hasValidHook =
        typeof hooks.install === 'function' ||
        typeof hooks.uninstall === 'function' ||
        typeof hooks.init === 'function';

      if (!hasValidHook) {
        const err = new Error(
          'Lifecycle module must export at least one hook (install, uninstall or init)',
        );
        err.name = 'InvalidLifecycleError';
        err.code = 'INVALID_LIFECYCLE';
        throw err;
      }

      lifecycles.set(moduleName, hooks);
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      console.error(`❌ [${moduleName}] ${error.message}`);
    }
  }

  return { lifecycles, errors };
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
    const err = new Error('Express app instance is required');
    err.name = 'InvalidAppError';
    err.code = 'INVALID_APP';
    throw err;
  }

  // Start timer
  const startTime = Date.now();

  // Create router
  const apiRouter = Router();

  // Create adapter
  const adapter = createContextAdapter(modulesContext);
  const allFiles = adapter.files();

  // Filter model and lifecycle paths
  const modelPaths = allFiles.filter(path => MODEL_PATH_PATTERN.test(path));
  const lifecyclePaths = allFiles.filter(path =>
    LIFECYCLE_PATH_PATTERN.test(path),
  );

  // Validate core modules are present
  const coreValidation = validateCoreModules(lifecyclePaths);
  if (!coreValidation.valid) {
    const err = new Error(
      `Core module validation failed: ${coreValidation.missing.join(', ')}`,
    );
    err.name = 'InvalidCoreModulesError';
    err.code = 'INVALID_CORE_MODULES';
    throw err;
  }

  // Sort to load core modules first
  const sortedModelPaths = sortModules(modelPaths);
  const sortedLifecyclePaths = sortModules(lifecyclePaths);

  // Load models first (needed for lifecycle)
  const { models, errors: modelErrors } = await loadModels(
    adapter,
    sortedModelPaths,
    app,
  );

  // Load modules
  const { lifecycles, errors: lifecycleErrors } = await loadModules(
    adapter,
    sortedLifecyclePaths,
  );

  // Combine all errors
  const errors = [...modelErrors, ...lifecycleErrors];

  // Initialize all modules
  for (const [name, hooks] of lifecycles) {
    if (hooks && typeof hooks.init === 'function') {
      try {
        await hooks.init(app, apiRouter, { Router, CORE_MODULES });
      } catch (error) {
        console.error(`❌ [${name}] Initialize failed:`, error.message);
      }
    }
  }

  // Fail if any core module failed to load
  const failedCoreModules = errors
    .filter(error => CORE_MODULES.has(error.moduleName))
    .map(error => error.moduleName);

  if (failedCoreModules.length > 0) {
    const err = new Error(
      `Failed to load core modules: ${failedCoreModules.join(
        ', ',
      )}. Application cannot start.`,
    );
    err.name = 'InvalidCoreModulesError';
    err.code = 'INVALID_CORE_MODULES';
    throw err;
  }

  // Summary
  console.info(
    `📦 API: ${Object.keys(models).length} model(s), ${lifecycles.size} lifecycle(s) loaded in ${Date.now() - startTime}ms`,
  );

  if (errors.length > 0) {
    console.warn(`⚠️ API: ${errors.length} module(s) failed to load`);
  }

  // Register models on app instance
  app.set('models', models);

  return { apiModels: models, apiRouter };
}
