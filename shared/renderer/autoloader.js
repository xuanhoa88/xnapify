/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * View Module Autoloader
 *
 * Discovers and loads view modules from the apps directory.
 * Each module exports independent lifecycle hooks:
 *   - translations() — returns a webpack require.context for locale JSON files
 *   - providers()    — share client-side services/state across modules (DI bindings)
 *   - views()        — returns a webpack require.context for view routes
 *
 * Mirrors the API autoloader pattern (shared/api/autoloader.js).
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';
import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Pattern to match view lifecycle files: ./moduleName/views/index.js */
const LIFECYCLE_PATH_PATTERN = /^\.\/([^/]+)\/views\/index\.[cm]?[jt]s$/i;

/**
 * Ordered lifecycle phases. The sequence is intentional:
 *   translations — register i18n namespaces first (providers/views may use them)
 *   providers    — bind DI services (views may consume them)
 *   views        — collect route contexts last, once bindings are ready
 */
const LIFECYCLE_PHASES = ['translations', 'providers', 'routes'];

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'ViewAutoloader';

function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

// =============================================================================
// HELPERS
// =============================================================================

function getModuleName(filePath) {
  const match = filePath.match(LIFECYCLE_PATH_PATTERN);
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
// LIFECYCLE ENGINE
// =============================================================================

/**
 * Load all lifecycle hook objects from discovered paths.
 *
 * @param {object} adapter  - Webpack context adapter
 * @param {string[]} paths  - Sorted lifecycle file paths
 * @returns {{ lifecycles: Map<string, object>, errors: object[] }}
 */
function loadLifecycles(adapter, paths) {
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
 * @param {string}              phase      - Phase name
 * @param {Map<string, object>} lifecycles - Module name → hooks
 * @param {Function}            handler    - async (name, hook, hooks) => void
 * @returns {Promise<object[]>} errors
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
// ADAPTER MERGING
// =============================================================================

/**
 * Merges multiple per-module adapters into a single unified adapter.
 * This ensures layouts from any module (e.g. the (default) module's admin layout)
 * are globally visible when building routes for any other module.
 *
 * @param {Map<string, object>} adapters - Map of module name → adapter
 * @returns {object|null} Merged adapter or null if no adapters
 */
export function mergeAdapters(adapters) {
  if (adapters.size === 0) return null;

  // Build file → adapter lookup for O(1) resolution
  const fileMap = new Map();
  const allFiles = [];

  for (const adapter of adapters.values()) {
    for (const file of adapter.files()) {
      if (!fileMap.has(file)) {
        fileMap.set(file, adapter);
        allFiles.push(file);
      }
    }
  }

  return {
    files: () => allFiles,
    load: path => {
      const adapter = fileMap.get(path);
      if (!adapter) {
        const err = new Error(`View file not found in any module: ${path}`);
        err.name = 'ViewFileNotFoundError';
        err.status = 404;
        throw err;
      }
      return adapter.load(path);
    },
    resolve: path => {
      const adapter = fileMap.get(path);
      return adapter ? adapter.resolve(path) : null;
    },
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Discover and boot all view modules in lifecycle order.
 *
 * @param {object} modulesContext - Webpack require.context or compatible
 * @param {object} context - DI context
 * @returns {Promise<{ viewAdapters: Map, mergedAdapter: object|null, errors: object[] }>}
 */
export async function discoverModules(modulesContext, context) {
  const startTime = Date.now();
  const adapter = createWebpackContextAdapter(modulesContext);

  // Filter lifecycle paths
  const lifecyclePaths = adapter
    .files()
    .filter(p => LIFECYCLE_PATH_PATTERN.test(p));

  // Load hook objects
  const { lifecycles, errors: loadErrors } = loadLifecycles(
    adapter,
    lifecyclePaths,
  );
  const errors = [...loadErrors];

  // ─── Phase 1: translations ──────────────────────────────────────────────
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

  // ─── Phase 2: providers ─────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('providers', lifecycles, async (name, hook) => {
      try {
        await hook(context);
        log(`[${name}] Providers`);
      } catch (error) {
        // PersistentBindingError = idempotent re-registration on same container
        if (error.name === 'PersistentBindingError') return;
        throw error;
      }
    })),
  );

  // ─── Phase 3: views ─────────────────────────────────────────────────────
  const viewAdapters = new Map();
  errors.push(
    ...(await runPhase('routes', lifecycles, (name, hook) => {
      const viewContext = hook();
      if (viewContext) {
        const rawAdapter = createWebpackContextAdapter(viewContext);
        const prefix = `./${name}/views`;
        viewAdapters.set(name, {
          files: () => rawAdapter.files().map(p => p.replace(/^\./, prefix)),
          load: p => rawAdapter.load(p.replace(prefix, '.')),
          resolve: p => rawAdapter.resolve(p.replace(prefix, '.')),
        });
      }
    })),
  );

  // ─── Merge adapters ─────────────────────────────────────────────────────
  const mergedAdapter = mergeAdapters(viewAdapters);

  // ─── Summary ────────────────────────────────────────────────────────────
  log(
    `${lifecycles.size} lifecycle(s), ${viewAdapters.size} view adapter(s) loaded in ${Date.now() - startTime}ms`,
  );

  if (errors.length > 0) {
    log(`${errors.length} error(s) during module loading`, 'warn');
  }

  return { viewAdapters, mergedAdapter, errors };
}
