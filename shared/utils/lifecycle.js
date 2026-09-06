/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Shared lifecycle phase constants.
 *
 * All module loaders (autoloaders and extension managers) MUST execute
 * phases in the order defined here. This is the SINGLE SOURCE OF TRUTH
 * for lifecycle ordering.
 */

// =============================================================================
// API LIFECYCLE
// =============================================================================

/**
 * API-side lifecycle phases (both autoloader and ExtensionManager).
 *
 *   translations — register i18n namespaces (no DB dependency)
 *   providers    — bind DI services (boot/seeds may consume them)
 *   migrations   — create/alter tables (schema must exist before ORM init)
 *   models       — register ORM definitions on top of existing tables
 *   seeds        — populate data after schema + models are ready
 *   boot         — run auth hooks / schedulers after DB is fully ready
 *   shutdown     — teardown on module unload (reverse of boot)
 *   routes       — mount routes last, once the app is fully initialised
 */
export const API_LIFECYCLE_PHASES = [
  'translations',
  'providers',
  'migrations',
  'models',
  'seeds',
  'boot',
  'shutdown',
  'routes',
];

// =============================================================================
// VIEW LIFECYCLE
// =============================================================================

/**
 * View-side lifecycle phases (both autoloader and ExtensionManager).
 *
 *   translations — register i18n namespaces (no DB dependency)
 *   providers    — bind DI services (boot/views may consume them)
 *   menus        — contribute navigation entries for the whole module
 *   boot         — run initialization logic after bindings are ready
 *   shutdown     — teardown on module unload (reverse of boot)
 *   routes       — collect/inject route contexts last
 *
 * `menus` exists so that navigation is a property of the module rather than
 * of one of its routes. Registering a sidebar entry from a route's `setup()`
 * hook forced the router to evaluate every route module before it could draw
 * the sidebar, which in turn pinned every view into a single bundle. Modules
 * declare their navigation here and their routes stay independently loadable.
 */
export const VIEW_LIFECYCLE_PHASES = [
  'translations',
  'providers',
  'menus',
  'boot',
  'shutdown',
  'routes',
];

// =============================================================================
// PROCESS DRAIN STATE
// =============================================================================

/**
 * Whether this process has started shutting down.
 *
 * Readiness must flip before the teardown starts: an orchestrator keeps
 * routing traffic to a pod that still answers `/api/ready` with 200, so a pod
 * being rolled would tear its engines down underneath live requests. Liveness
 * is deliberately unaffected — a draining process is still alive.
 */
let draining = false;

/**
 * Mark this process as draining. Idempotent, and never reversible: a process
 * that has begun shutting down never returns to service.
 *
 * @returns {void}
 */
export function beginDraining() {
  draining = true;
}

/**
 * @returns {boolean} Whether this process has begun shutting down
 */
export function isDraining() {
  return draining;
}

// =============================================================================
// RECOGNIZED EXTENSION KEYS
// =============================================================================

/**
 * All recognised lifecycle hooks for extension validation.
 * Derived from the union of both phase arrays + one-time hooks (install/uninstall).
 * An extension must have at least one of these to be accepted by register().
 */
export const LIFECYCLE_HOOKS = [
  ...new Set([
    'install',
    ...API_LIFECYCLE_PHASES,
    ...VIEW_LIFECYCLE_PHASES,
    'uninstall',
  ]),
];
