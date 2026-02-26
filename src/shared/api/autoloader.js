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
 *   - models()     — returns a webpack require.context for models
 *   - shared()     — share services/constants across modules (DI bindings)
 *   - migrations() — run database migrations (all tables created first)
 *   - seeds()      — run database seeds (after all tables exist)
 *   - init()       — initialisation logic (auth hooks, etc.)
 *   - routes()     — returns a webpack require.context for routes
 *
 * Core modules (like 'users') are loaded first to ensure proper dependency order.
 */

import { createContextAdapter } from '../context';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Pattern to match module lifecycle files: ./moduleName/api/index.js */
const LIFECYCLE_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/i;

/**
 * Ordered lifecycle phases. The sequence is intentional:
 *   models     — register data structures first (migrations depend on them)
 *   shared     — bind DI services (init/seeds may consume them)
 *   migrations — create all tables before any data is inserted
 *   seeds      — populate data after schema is guaranteed to exist
 *   init       — run auth hooks / schedulers after DB is fully ready
 *   routes     — mount routes last, once the app is fully initialised
 */
const LIFECYCLE_PHASES = [
  'models',
  'shared',
  'migrations',
  'seeds',
  'init',
  'routes',
];

// =============================================================================
// CORE MODULES CONFIGURATION
// =============================================================================

/**
 * Parse additional core modules from environment variable.
 * Format: RSK_MODULE_DEFAULTS=admin,reports
 */
function parseEnvCoreModules() {
  const envValue = process.env.RSK_MODULE_DEFAULTS;
  if (!envValue || typeof envValue !== 'string') return [];
  return envValue
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Set of core modules that must always be present.
 * Additional modules come from RSK_MODULE_DEFAULTS.
 */
const CORE_MODULES = new Set([
  'permissions',
  'roles',
  'groups',
  'users',
  'plugins',
  'auth',
  ...parseEnvCoreModules(),
]);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Autoloader';

function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

// =============================================================================
// HELPERS
// =============================================================================

function getModuleName(filePath, pattern = LIFECYCLE_PATH_PATTERN) {
  const match = filePath.match(pattern);
  return (match && match[1]) || 'unknown';
}

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

export function sortModules(modulePaths) {
  const corePriority = new Map(
    Array.from(CORE_MODULES).map((name, index) => [name, index]),
  );

  return [...modulePaths].sort((a, b) => {
    const nameA = getModuleName(a);
    const nameB = getModuleName(b);
    const pa = corePriority.has(nameA) ? corePriority.get(nameA) : Infinity;
    const pb = corePriority.has(nameB) ? corePriority.get(nameB) : Infinity;
    return pa !== pb ? pa - pb : a.localeCompare(b);
  });
}

export function validateCoreModules(modulePaths, options = {}) {
  const { strictCoreModules = true } = options;

  const found = new Set(modulePaths.map(p => getModuleName(p)).filter(Boolean));
  const missing = Array.from(CORE_MODULES).filter(n => !found.has(n));

  if (missing.length > 0) {
    const message = `Missing required core module(s): ${missing.join(', ')}`;
    if (strictCoreModules) {
      const err = new Error(message);
      err.name = 'MissingCoreModulesError';
      err.code = 'MISSING_CORE_MODULES';
      throw err;
    }
    log(message, 'warn');
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

// =============================================================================
// MODEL LOADING
// =============================================================================

async function loadModelsFromContext(modelContext, moduleName, db, app) {
  const adapter = createContextAdapter(modelContext);
  const models = {};
  const errors = [];

  for (const filePath of adapter.files()) {
    const fileName = filePath.split('/').pop();
    if (
      /^index\.[cm]?[jt]s$/i.test(fileName) ||
      /\.(test|spec)\.[cm]?[jt]s$/i.test(fileName)
    )
      continue;

    try {
      const factory = loadModuleFactory(adapter, filePath);
      const model = await factory(db, app);

      if (!model) {
        log(
          `[${moduleName}] "${filePath}" did not return a valid object`,
          'warn',
        );
        continue;
      }
      if (!model.name) {
        log(
          `[${moduleName}] "${filePath}" returned an object without a name property`,
          'warn',
        );
        continue;
      }
      if (
        typeof model.findAll !== 'function' ||
        typeof model.create !== 'function'
      ) {
        log(
          `[${moduleName}] "${model.name}" doesn't appear to be a Sequelize model`,
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

// =============================================================================
// LIFECYCLE ENGINE  ← single-pass, phase-first
// =============================================================================

/**
 * Load all lifecycle hook objects from sorted paths.
 *
 * @param {object} adapter
 * @param {string[]} paths
 * @returns {Promise<{lifecycles: Map<string, object>, errors: object[]}>}
 */
async function loadLifecycles(adapter, paths) {
  const lifecycles = new Map();
  const errors = [];

  for (const filePath of paths) {
    const moduleName = getModuleName(filePath);

    try {
      const hooks = adapter.load(filePath);

      if (!hooks || typeof hooks !== 'object') {
        const err = new Error(
          'Lifecycle module must export an object with lifecycle hooks',
        );
        err.name = 'InvalidLifecycleError';
        err.code = 'INVALID_LIFECYCLE';
        throw err;
      }

      const hasValidHook = LIFECYCLE_PHASES.some(
        p => typeof hooks[p] === 'function',
      );
      if (!hasValidHook) {
        const err = new Error(
          `Lifecycle module must export at least one hook: ${LIFECYCLE_PHASES.join(', ')}`,
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

/**
 * Execute a single lifecycle phase across all modules.
 * Collects errors without interrupting other modules.
 *
 * @param {string}                  phase      - Phase name (e.g. 'init')
 * @param {Map<string, object>}     lifecycles - Module name → hooks
 * @param {Function}                handler    - async (name, hook, hooks) => void
 * @returns {Promise<object[]>}     errors
 */
async function runPhase(phase, lifecycles, handler) {
  const errors = [];

  for (const [name, hooks] of lifecycles) {
    if (typeof hooks[phase] !== 'function') continue;

    try {
      await handler(name, hooks[phase], hooks);
    } catch (error) {
      errors.push(createLoadError(name, `${phase}()`, error));
      log(`[${name}] ${phase}() failed: ${error.message}`, 'error');
    }
  }

  return errors;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and boot all API modules in lifecycle order.
 *
 * @param {object} modulesContext - Webpack require.context or compatible
 * @param {object} app            - Express app instance
 * @returns {Promise<{apiModels: object, routeAdapters: Map, errors: object[]}>}
 */
export async function discoverModules(modulesContext, app) {
  if (!app) {
    const err = new Error('Express app instance is required');
    err.name = 'InvalidAppError';
    err.code = 'INVALID_APP';
    throw err;
  }

  const startTime = Date.now();
  const adapter = createContextAdapter(modulesContext);

  // Filter → validate → sort  (one pass over files)
  const lifecyclePaths = adapter
    .files()
    .filter(p => LIFECYCLE_PATH_PATTERN.test(p));
  validateCoreModules(lifecyclePaths);
  const sortedPaths = sortModules(lifecyclePaths);

  // Load hook objects
  const { lifecycles, errors: loadErrors } = await loadLifecycles(
    adapter,
    sortedPaths,
  );
  const errors = [...loadErrors];

  // ─── Phase 1: models ──────────────────────────────────────────────────────
  const db = app.get('db');
  const allModels = {};

  if (!db) {
    log('No database connection found, skipping models', 'warn');
  } else {
    errors.push(
      ...(await runPhase('models', lifecycles, async (name, hook) => {
        const modelContext = hook();
        if (!modelContext) return;

        const { models, errors: modelErrors } = await loadModelsFromContext(
          modelContext,
          name,
          db,
          app,
        );
        errors.push(...modelErrors);

        for (const [modelName, model] of Object.entries(models)) {
          if (modelName in allModels) {
            log(
              `Duplicate model "${modelName}" from module "${name}". Skipped.`,
              'error',
            );
            continue;
          }
          allModels[modelName] = model;
        }
      })),
    );

    // Initialise Sequelize associations after all models are collected
    for (const [modelName, model] of Object.entries(allModels)) {
      if (typeof model.associate !== 'function') continue;
      try {
        model.associate(allModels);
        log(`[${modelName}] Associations initialized`);
      } catch (error) {
        errors.push(
          createLoadError(modelName, `${modelName}.associate()`, error),
        );
        log(
          `[${modelName}] Failed to initialize associations: ${error.message}`,
          'error',
        );
      }
    }
  }

  app.set('models', allModels);

  // ─── Phase 2: shared ──────────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('shared', lifecycles, (_, hook) => hook(app))),
  );

  // ─── Phase 3: migrations ──────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('migrations', lifecycles, (_, hook) => hook(app))),
  );

  // ─── Phase 4: seeds ───────────────────────────────────────────────────────
  errors.push(...(await runPhase('seeds', lifecycles, (_, hook) => hook(app))));

  // ─── Phase 5: init ────────────────────────────────────────────────────────
  errors.push(...(await runPhase('init', lifecycles, (_, hook) => hook(app))));

  // ─── Phase 6: routes ──────────────────────────────────────────────────────
  const routeAdapters = new Map();
  errors.push(
    ...(await runPhase('routes', lifecycles, (name, hook) => {
      const routeContext = hook();
      if (routeContext)
        routeAdapters.set(name, createContextAdapter(routeContext));
    })),
  );

  // ─── Guard: fail fast if any core module had errors ───────────────────────
  const failedCore = [
    ...new Set(
      errors.filter(e => CORE_MODULES.has(e.moduleName)).map(e => e.moduleName),
    ),
  ];

  if (failedCore.length > 0) {
    const err = new Error(
      `Failed to load core module(s): ${failedCore.join(', ')}. Application cannot start.`,
    );
    err.name = 'InvalidCoreModulesError';
    err.code = 'INVALID_CORE_MODULES';
    throw err;
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  log(
    `${Object.keys(allModels).length} model(s), ${lifecycles.size} lifecycle(s), ` +
      `${routeAdapters.size} route context(s) loaded in ${Date.now() - startTime}ms`,
  );

  if (errors.length > 0) {
    log(`${errors.length} error(s) during module loading`, 'warn');
  }

  return { apiModels: allModels, routeAdapters, errors };
}
