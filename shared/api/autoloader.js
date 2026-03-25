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
 *   - providers()     — share services/constants across modules (DI bindings)
 *   - migrations() — run database migrations (all tables created first)
 *   - seeds()      — run database seeds (after all tables exist)
 *   - boot()        — initialisation logic (auth hooks, etc.)
 *   - routes()     — returns a webpack require.context for routes
 *
 * Core modules (like 'users') are loaded first to ensure proper dependency order.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';
import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

import ModelRegistry from './ModelRegistry';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Pattern to match module lifecycle files: ./moduleName/api/index.js */
const LIFECYCLE_PATH_PATTERN = /^\.\/([^/]+)\/api\/index\.[cm]?[jt]s$/i;

/**
 * Ordered lifecycle phases. The sequence is intentional:
 *   models     — register data structures first (migrations depend on them)
 *   shared     — bind DI services (boot/seeds may consume them)
 *   migrations — create all tables before any data is inserted
 *   seeds      — populate data after schema is guaranteed to exist
 *   boot       — run auth hooks / schedulers after DB is fully ready
 *   routes     — mount routes last, once the app is fully initialised
 */
const LIFECYCLE_PHASES = [
  'translations',
  'models',
  'providers',
  'migrations',
  'seeds',
  'boot',
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
  'auth',
  'files',
  'extensions',
  'emails',
  'webhooks',
  'search',
  'activities',
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
      const raw = adapter.load(filePath);
      const hooks = (raw && raw.default) || raw;

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
 * @param {string}                  phase      - Phase name (e.g. 'boot')
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
 * @param {object} container     - DI container instance
 * @returns {Promise<{apiModels: object, apiRoutes: Map, errors: object[]}>}
 */
export async function discoverModules(modulesContext, container) {
  const startTime = Date.now();
  const adapter = createWebpackContextAdapter(modulesContext);

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

  // ─── Phase 1: translations ────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('translations', lifecycles, (name, hook) => {
      const translationContext = hook();
      if (translationContext) {
        const translations = getTranslations(translationContext);
        if (translations && Object.keys(translations).length > 0) {
          addNamespace(name, translations);
        }
      }
    })),
  );

  // ─── Phase 2: models ──────────────────────────────────────────────────────
  const registry = new ModelRegistry(
    container.has('db') ? container.resolve('db') : null,
  );

  errors.push(
    ...(await runPhase('models', lifecycles, async (name, hook) => {
      const modelContext = hook();
      if (!modelContext) return;

      const { errors: modelErrors } = await registry.discover(
        modelContext,
        name,
      );
      errors.push(...modelErrors);
    })),
  );

  // Initialise associations and seal core models
  errors.push(...registry.associate());
  registry.seal();

  container.instance('models', registry);

  // ─── Phase 3: providers ───────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('providers', lifecycles, (_, hook) =>
      hook({ container }),
    )),
  );

  // ─── Phase 4: migrations ──────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('migrations', lifecycles, (_, hook) =>
      hook({ container }),
    )),
  );

  // ─── Phase 5: seeds ───────────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('seeds', lifecycles, (_, hook) => hook({ container }))),
  );

  // ─── Phase 6: boot ────────────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('boot', lifecycles, (_, hook) => hook({ container }))),
  );

  // ─── Phase 7: routes ──────────────────────────────────────────────────────
  const apiRoutes = new Map();
  errors.push(
    ...(await runPhase('routes', lifecycles, (name, hook) => {
      const routeContext = hook();
      if (routeContext) {
        const rawAdapter = createWebpackContextAdapter(routeContext);
        const prefix = `./${name}/api/routes`;
        const wrappedAdapter = {
          files: () => rawAdapter.files().map(p => p.replace(/^\./, prefix)),
          load: p => rawAdapter.load(p.replace(prefix, '.')),
          resolve: p => rawAdapter.resolve(p.replace(prefix, '.')),
        };
        apiRoutes.set(name, wrappedAdapter);
      }
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
    `${registry.size} model(s), ${lifecycles.size} lifecycle(s), ` +
      `${apiRoutes.size} route context(s) loaded in ${Date.now() - startTime}ms`,
  );

  if (errors.length > 0) {
    log(`${errors.length} error(s) during module loading`, 'warn');
  }

  return { apiModels: registry, apiRoutes, errors };
}
