/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * View Module Autoloader
 *
 * Discovers and loads view modules from the apps directory.
 * Each module exports independent lifecycle hooks:
 *   - translations() — returns a rspack import.meta.webpackContext for locale JSON files
 *   - providers()    — share client-side services/state across modules (DI bindings)
 *   - views()        — returns a rspack import.meta.webpackContext for view routes
 *
 * Mirrors the API autoloader pattern (shared/api/autoloader.js).
 *
 * Discovery is split into two halves:
 *   - the static half (load lifecycles, register translations, collect route
 *     contexts) depends only on the bundle and is computed once per process
 *     and per modules context;
 *   - the dynamic half (providers, boot) receives the caller's context and
 *     runs every time, because on the server that context is per request.
 */

import { registerResourceContext } from '@shared/i18n/resources.js';
import { createRspackContextAdapter } from '@shared/utils/contextAdapter.js';
import { VIEW_LIFECYCLE_PHASES } from '@shared/utils/lifecycle.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Pattern to match view lifecycle files: ./moduleName/views/index.js */
const LIFECYCLE_PATH_PATTERN = /^\.\/([^/]+)\/views\/index\.[cm]?[jt]s$/i;

/**
 * Ordered lifecycle phases.
 * @see shared/utils/lifecycle.js — single source of truth
 */
const LIFECYCLE_PHASES = VIEW_LIFECYCLE_PHASES.filter(p => p !== 'shutdown');

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
 * @param {object} adapter  - Rspack context adapter
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

  // Every source must agree on the loading strategy: the merged adapter is
  // handed to a single collector, which cannot mix deferred and immediate
  // entries for one file set. Disagreement is a wiring mistake, not a
  // fallback — taking the eager path over a `mode: 'lazy'` context stores
  // the load() promise itself as the module, so every route in the app
  // silently resolves to "no component". Name the offenders instead.
  const entries = [...adapters.entries()];
  const eager = entries
    .filter(([, a]) => a.lazy !== true)
    .map(([name]) => name);
  if (eager.length > 0 && eager.length !== entries.length) {
    const err = new Error(
      `View modules disagree on route loading strategy: ${eager.join(', ')} ` +
        `returned an eager context while the rest are lazy. Return ` +
        `[context, { lazy: true }] from routes() in each module's views/index.js.`,
    );
    err.name = 'MixedRouteLoadingStrategyError';
    throw err;
  }
  const lazy = eager.length === 0;

  return {
    lazy,
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
// STATIC DISCOVERY (once per process per modules context)
// =============================================================================

/** @type {WeakMap<object, Promise<object>>} modulesContext → static discovery */
let staticCache = new WeakMap();

/**
 * Forget every cached discovery. Called on HMR so edited modules are
 * re-discovered; harmless on the client.
 */
export function resetDiscoveryCache() {
  staticCache = new WeakMap();
}

/**
 * Load lifecycles, register translations and collect route contexts.
 * Pure with respect to the caller: no context is needed, so the result is
 * shared by every subsequent call for the same modules context.
 *
 * @param {object} modulesContext - Rspack import.meta.webpackContext or compatible
 * @returns {Promise<{ lifecycles: Map, viewAdapters: Map, mergedAdapter: object|null, errors: object[] }>}
 */
export function discoverViewModules(modulesContext) {
  let pending = staticCache.get(modulesContext);
  if (pending) return pending;

  pending = (async () => {
    const startTime = Date.now();
    const adapter = createRspackContextAdapter(modulesContext);

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

    // ─── Phase 1: translations ────────────────────────────────────────────
    errors.push(
      ...(await runPhase('translations', lifecycles, async (name, hook) => {
        const result = hook();
        if (!result) return;

        const [translationContext, customNs] = Array.isArray(result)
          ? result
          : [result];
        if (!translationContext) return;

        // Hand over the context rather than its contents: the registry pulls
        // only the locale in use, and pulls another one if the language
        // changes. See shared/i18n/resources.js.
        await registerResourceContext(customNs || name, translationContext);
      })),
    );

    // ─── Phase 4: views (route contexts) ──────────────────────────────────
    const viewAdapters = new Map();
    errors.push(
      ...(await runPhase('routes', lifecycles, (name, hook) => {
        // The hook returns either a context, or `[context, { lazy }]`.
        // A lazy context returns promises from load(), so the router builds
        // the tree from file paths and fetches each view when it is matched.
        const result = hook();
        const [viewContext, contextOptions = {}] = Array.isArray(result)
          ? result
          : [result];

        if (viewContext) {
          const rawAdapter = createRspackContextAdapter(viewContext);
          const prefix = `./${name}/views`;
          viewAdapters.set(name, {
            lazy: contextOptions.lazy === true,
            files: () => rawAdapter.files().map(p => p.replace(/^\./, prefix)),
            load: p => rawAdapter.load(p.replace(prefix, '.')),
            resolve: p => rawAdapter.resolve(p.replace(prefix, '.')),
          });
        }
      })),
    );

    const mergedAdapter = mergeAdapters(viewAdapters);

    log(
      `${lifecycles.size} lifecycle(s), ${viewAdapters.size} view adapter(s) discovered in ${Date.now() - startTime}ms`,
    );

    return { lifecycles, viewAdapters, mergedAdapter, errors };
  })();

  // Do not cache a failed discovery; the next caller retries
  pending.catch(() => {
    if (staticCache.get(modulesContext) === pending) {
      staticCache.delete(modulesContext);
    }
  });

  staticCache.set(modulesContext, pending);
  return pending;
}

// =============================================================================
// DYNAMIC BOOT (per caller context)
// =============================================================================

/**
 * Run the context-dependent phases (providers → boot) for already
 * discovered modules.
 *
 * @param {Map<string, object>} lifecycles - Module name → hooks
 * @param {object} context - DI context (store, container, ...)
 * @returns {Promise<object[]>} errors
 */
/**
 * Run the `menus` phase on its own.
 *
 * Menu payloads hold translated strings, not keys, so they are only correct
 * for the language they were built in. The server rebuilds them per request;
 * the browser boots once and must rebuild them itself whenever the reader
 * switches language, or the sidebar stays in the old language until a full
 * reload. `registerMenu` overwrites a section by id, so re-running is
 * idempotent.
 *
 * @param {Map<string, object>} lifecycles - Module name → hooks
 * @param {object} context - DI context (store, i18n, ...)
 * @returns {Promise<object[]>} errors
 */
export async function runMenuModules(lifecycles, context) {
  return runPhase('menus', lifecycles, (_, hook) => hook(context));
}

export async function bootViewModules(lifecycles, context) {
  const errors = [];

  // ─── Phase 2: providers ─────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('providers', lifecycles, async (name, hook) => {
      try {
        await hook(context);
        if (__DEV__) log(`[${name}] Providers`);
      } catch (error) {
        // PersistentBindingError = idempotent re-registration on same container
        if (error.name === 'PersistentBindingError') return;
        throw error;
      }
    })),
  );

  // ─── Phase 3: menus ─────────────────────────────────────────────────────
  // Navigation belongs to the module, not to one of its routes. Running it
  // here means the sidebar is complete before the first render without any
  // route module having been loaded. See shared/utils/lifecycle.js.
  errors.push(...(await runMenuModules(lifecycles, context)));

  // ─── Phase 4: boot ──────────────────────────────────────────────────────
  errors.push(
    ...(await runPhase('boot', lifecycles, (_, hook) => hook(context))),
  );

  return errors;
}
