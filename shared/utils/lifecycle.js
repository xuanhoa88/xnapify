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
 *   boot         — run initialization logic after bindings are ready
 *   shutdown     — teardown on module unload (reverse of boot)
 *   routes       — collect/inject route contexts last
 */
export const VIEW_LIFECYCLE_PHASES = [
  'translations',
  'providers',
  'boot',
  'shutdown',
  'routes',
];

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
