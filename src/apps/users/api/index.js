/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { authenticate as handleApiKeyStrategy } from './utils/apiKey';
import { getUserRBACData } from './utils/rbac/fetcher';

// Auto-load migrations via require.context
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load seeds via require.context
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// Auto-load models via require.context
const modelsContext = require.context('./models', false, /\.[cm]?[jt]s$/i);

// Auto-load routes via require.context
const routesContext = require.context('./routes', false, /\.[cm]?[jt]s$/i);

// =============================================================================
// LOGGING
// =============================================================================

const TAG = 'Users';

/**
 * Log a lifecycle phase message.
 *
 * @param {string} phase - Lifecycle phase name
 */
function log(phase) {
  console.info(`[${TAG}] ✅ ${phase}`);
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Run database migrations and seeds.
 *
 * @param {Object} app - Express app instance
 */
async function runMigrations(app) {
  const db = app.get('db');

  await db.connection.runMigrations([
    { context: migrationsContext, prefix: 'users' },
  ]);

  await db.connection.runSeeds([{ context: seedsContext, prefix: 'users' }]);

  log('Database migrated');
}

/**
 * Bind shared services into the DI container.
 *
 * @param {Object} app - Express app instance
 */
async function bindServices(app) {
  const container = app.get('container');

  container.bind('users:services', () => {
    return {
      // Controllers
      controllers: {
        login(_req, res, _next) {
          res.status(200).json({ message: 'Login' });
        },
        logout(_req, res, _next) {
          res.status(200).json({ message: 'Logout' });
        },
        forgotPassword(_req, res, _next) {
          res.status(200).json({ message: 'Forgot Password' });
        },
        resetPassword(_req, res, _next) {
          res.status(200).json({ message: 'Reset Password' });
        },
        register(_req, res, _next) {
          res.status(200).json({ message: 'Register' });
        },
        verifyEmail(_req, res, _next) {
          res.status(200).json({ message: 'Verify Email' });
        },
        changePassword(_req, res, _next) {
          res.status(200).json({ message: 'Change Password' });
        },
        changeEmail(_req, res, _next) {
          res.status(200).json({ message: 'Change Email' });
        },
        changeAvatar(_req, res, _next) {
          res.status(200).json({ message: 'Change Avatar' });
        },
        getProfile(_req, res, _next) {
          res.status(200).json({ message: 'Get Profile' });
        },
        updateProfile(_req, res, _next) {
          res.status(200).json({ message: 'Update Profile' });
        },
        deleteAccount(_req, res, _next) {
          res.status(200).json({ message: 'Delete Account' });
        },
      },
      // Utils
      utils: {
        generateToken: () => {
          return 'Generated Token';
        },
        verifyToken: () => {
          return 'Verified Token';
        },
        generatePassword: () => {
          return 'Generated Password';
        },
        verifyPassword: () => {
          return 'Verified Password';
        },
        hashPassword: () => {
          return 'Hashed Password';
        },
        verifyHashPassword: () => {
          return 'Verified Hash Password';
        },
      },
    };
  });

  log('Services bound');
}

/**
 * Register auth strategies and RBAC hook listeners.
 *
 * @param {Object} app - Express app instance
 */
async function registerAuthHooks(app) {
  const hook = app.get('hook');

  hook('auth.strategy.api_key').on('authenticate', handleApiKeyStrategy);
  hook('auth.permissions').on('resolve', getUserRBACData);
  hook('auth.roles').on('resolve', getUserRBACData);
  hook('auth.groups').on('resolve', getUserRBACData);
  hook('auth.ownership').on('resolve', getUserRBACData);

  log('Auth hooks registered');
}

// =============================================================================
// PUBLIC LIFECYCLE HOOKS
// =============================================================================

/**
 * Init hook — called by the autoloader to initialise this module.
 *
 * Orchestrates internal phases in order:
 *   1. runMigrations     — database migrations & seeds
 *   2. bindServices      — DI service bindings
 *   3. registerAuthHooks — auth strategy & RBAC registrations
 *
 * @param {Object} app - Express app instance
 * @param {Object} _options - Options ({ CORE_MODULES })
 */
export async function init(app, _options) {
  await runMigrations(app);
  await bindServices(app);
  await registerAuthHooks(app);
}

/**
 * Models hook — returns the webpack require.context for this module's models.
 *
 * Called independently by the autoloader so each module
 * can be built and resolved as a standalone webpack entry.
 *
 * @returns {object} Webpack require.context for models
 */
export function models() {
  log('Models declared');
  return modelsContext;
}

/**
 * Routes hook — returns the webpack require.context for this module's routes.
 *
 * Called independently by the dynamic router so each module
 * can be built and resolved as a standalone webpack entry.
 *
 * @returns {object} Webpack require.context for routes
 */
export function routes() {
  log('Routes declared');
  return routesContext;
}
