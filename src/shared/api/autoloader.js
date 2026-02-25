/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * API Module Autoloader
 *
 * Discovers and loads API modules from the apps directory.
 * Each module exports independent lifecycle hooks:
 *   - init(app, apiRouter, options)  — initialisation logic
 *   - models()                       — returns a webpack require.context for models
 *   - routes()                       — returns a webpack require.context for routes
 *
 * Core modules (like 'users') are loaded first to ensure proper dependency order.
 */

import { createContextAdapter } from '../context';

// =============================================================================
// CONSTANTS
// =============================================================================

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
 * 'users', 'roles', 'groups', 'permissions', 'plugins', 'auth' are always required;
 * additional modules come from RSK_MODULE_DEFAULTS.
 */
const CORE_MODULES = new Set([
  'users',
  'roles',
  'groups',
  'permissions',
  'plugins',
  'auth',
  ...parseEnvCoreModules(),
]);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Autoloader';

/**
 * Log an autoloader message.
 *
 * @param {string} message - Message text
 * @param {'info'|'warn'|'error'} [level='info'] - Log level
 */
function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  switch (level) {
    case 'error':
      console.error(`${prefix} ❌ ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`);
      break;
    default:
      console.info(`${prefix} ✅ ${message}`);
  }
}

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
    const nameA = getModuleName(a, LIFECYCLE_PATH_PATTERN);
    const nameB = getModuleName(b, LIFECYCLE_PATH_PATTERN);

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

    log(message, 'warn');
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

// =============================================================================
// MODEL LOADING
// =============================================================================

/**
 * Load models from a single module's require.context.
 *
 * @param {object} modelContext - Webpack require.context returned by hooks.models()
 * @param {string} moduleName - Name of the owning module (for logging)
 * @param {object} db - Database connection
 * @param {object} app - Express app instance
 * @returns {Promise<{models: object, errors: object[]}>}
 */
async function loadModelsFromContext(modelContext, moduleName, db, app) {
  const adapter = createContextAdapter(modelContext);
  const models = {};
  const errors = [];

  for (const filePath of adapter.files()) {
    const fileName = filePath.split('/').pop();

    // Skip index files and test/spec files
    if (
      /^index\.[cm]?[jt]s$/i.test(fileName) ||
      /\.(test|spec)\.[cm]?[jt]s$/i.test(fileName)
    ) {
      continue;
    }

    try {
      const factory = loadModuleFactory(adapter, filePath);
      const model = await factory(db, app);

      // Validate model exists and has basic properties
      if (!model) {
        log(
          `[${moduleName}] File "${filePath}" did not return a valid object`,
          'warn',
        );
        continue;
      }

      if (!model.name) {
        log(
          `[${moduleName}] File "${filePath}" returned an object without a name property`,
          'warn',
        );
        continue;
      }

      // Validate it's a Sequelize model
      if (
        typeof model.findAll !== 'function' ||
        typeof model.create !== 'function'
      ) {
        log(
          `[${moduleName}] Model "${model.name}" doesn't appear to be a Sequelize model (missing findAll/create methods)`,
          'warn',
        );
        continue;
      }

      models[model.name] = model;
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      log(`[${moduleName}] ${error.message}`, 'error');
    }
  }

  return { models, errors };
}

/**
 * Collect models from all lifecycle modules that export a models() hook.
 * Runs each module's model factories and initialises associations.
 *
 * @param {Map<string, object>} lifecycles - Map of module name → hooks
 * @param {object} app - Express app instance
 * @returns {Promise<{models: object, errors: object[]}>}
 */
async function collectModels(lifecycles, app) {
  const db = app.get('db');

  if (!db) {
    log('No database connection found, skipping models', 'warn');
    return { models: {}, errors: [] };
  }

  const allModels = {};
  const allErrors = [];

  for (const [name, hooks] of lifecycles) {
    if (typeof hooks.models !== 'function') continue;

    try {
      const modelContext = hooks.models();
      if (!modelContext) continue;

      const { models, errors } = await loadModelsFromContext(
        modelContext,
        name,
        db,
        app,
      );

      // Check for duplicate model names across modules
      for (const [modelName, model] of Object.entries(models)) {
        if (modelName in allModels) {
          const error = new Error(
            `Duplicate model name: "${modelName}" from module "${name}". Skipped.`,
          );
          allErrors.push(createLoadError(name, modelName, error));
          log(`[${name}] ${error.message}`, 'error');
          continue;
        }
        allModels[modelName] = model;
      }

      allErrors.push(...errors);
    } catch (error) {
      allErrors.push(createLoadError(name, 'models()', error));
      log(`[${name}] Failed to collect models: ${error.message}`, 'error');
    }
  }

  // Initialize associations after all models are loaded
  Object.keys(allModels).forEach(modelName => {
    if (
      allModels[modelName] &&
      typeof allModels[modelName].associate === 'function'
    ) {
      try {
        allModels[modelName].associate(allModels);
        log(`[${modelName}] Associations initialized`);
      } catch (error) {
        allErrors.push(
          createLoadError(modelName, `${modelName}.associate()`, error),
        );
        log(
          `[${modelName}] Failed to initialize associations: ${error.message}`,
          'error',
        );
      }
    }
  });

  return { models: allModels, errors: allErrors };
}

// =============================================================================
// ROUTE COLLECTION
// =============================================================================

/**
 * Collect route contexts from all lifecycle modules that export a routes() hook.
 *
 * @param {Map<string, object>} lifecycles - Map of module name → hooks
 * @returns {Map<string, object>} Map of module name → route context adapter
 */
function collectRouteAdapters(lifecycles) {
  const adapters = new Map();

  for (const [name, hooks] of lifecycles) {
    if (typeof hooks.routes !== 'function') continue;

    try {
      const routeContext = hooks.routes();
      if (!routeContext) continue;

      adapters.set(name, createContextAdapter(routeContext));
    } catch (error) {
      log(`[${name}] Failed to collect routes: ${error.message}`, 'error');
    }
  }

  return adapters;
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
      // Direct load (supports object { init, models, routes })
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
        typeof hooks.init === 'function' ||
        typeof hooks.models === 'function' ||
        typeof hooks.routes === 'function';

      if (!hasValidHook) {
        const err = new Error(
          'Lifecycle module must export at least one hook (init, models, routes)',
        );
        err.name = 'InvalidLifecycleError';
        err.code = 'INVALID_LIFECYCLE';
        throw err;
      }

      lifecycles.set(moduleName, hooks);
    } catch (error) {
      errors.push(createLoadError(moduleName, filePath, error));
      log(`[${moduleName}] ${error.message}`, 'error');
    }
  }

  return { lifecycles, errors };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and load API modules.
 *
 * Scans the apps directory for lifecycle index files, validates core modules,
 * then calls each module's hooks in order:
 *   1. models()  — collect model contexts
 *   2. init()    — run initialisation (migrations, DI, auth hooks, etc.)
 *   3. routes()  — collect route contexts
 *
 * @param {object} modulesContext - Webpack require.context or compatible
 * @param {object} app - Express app instance
 * @returns {Promise<{apiModels: object, routeAdapters: Map, errors: object[]}>}
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

  // Create adapter
  const adapter = createContextAdapter(modulesContext);
  const allFiles = adapter.files();

  // Filter lifecycle paths
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
  const sortedLifecyclePaths = sortModules(lifecyclePaths);

  // Load lifecycle modules
  const { lifecycles, errors: lifecycleErrors } = await loadModules(
    adapter,
    sortedLifecyclePaths,
  );

  const errors = [...lifecycleErrors];

  // 1. Collect and load models from each module's models() hook
  const { models, errors: modelErrors } = await collectModels(lifecycles, app);
  errors.push(...modelErrors);

  // Register models on app instance
  app.set('models', models);

  // 2. Initialize all modules
  for (const [name, hooks] of lifecycles) {
    if (hooks && typeof hooks.init === 'function') {
      try {
        await hooks.init(app, { CORE_MODULES });
      } catch (error) {
        errors.push(createLoadError(name, 'init()', error));
        log(`[${name}] Initialize failed: ${error.message}`, 'error');
      }
    }
  }

  // 3. Collect route adapters from each module's routes() hook
  const routeAdapters = collectRouteAdapters(lifecycles);

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
  log(
    `${Object.keys(models).length} model(s), ${lifecycles.size} lifecycle(s), ${routeAdapters.size} route context(s) loaded in ${Date.now() - startTime}ms`,
  );

  if (errors.length > 0) {
    log(`${errors.length} module(s) had errors during loading`, 'warn');
  }

  return { apiModels: models, routeAdapters, errors };
}
