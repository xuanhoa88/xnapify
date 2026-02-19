/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import userRoutes from './routes/admin/user.routes';
import roleRoutes from './routes/admin/role.routes';
import permissionRoutes from './routes/admin/permission.routes';
import groupRoutes from './routes/admin/group.routes';
import { authenticate as handleApiKeyStrategy } from './auth/apiKey';
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

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Initialize hook - runs on every application startup.
 * Use for registering global middlewares and mounting routes.
 *
 * @param {Object} app - Express app instance
 * @param {Router} apiRouter - Main API Router
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 */
export async function init(app, apiRouter, { Router }) {
  const db = app.get('db');

  // Run database migrations
  await db.connection.runMigrations([
    { context: migrationsContext, prefix: 'users' },
  ]);

  // Run database seeds
  await db.connection.runSeeds([{ context: seedsContext, prefix: 'users' }]);

  console.info('✅ [users] Migrations and seeds completed');

  // Register auth strategies
  app
    .get('hook')('auth.strategy.api_key')
    .on('authenticate', handleApiKeyStrategy);

  // Register permission resolver — populates req.user.permissions from DB
  app.get('hook')('auth.permissions').on('resolve', getUserRBACData);

  // Register role resolver — populates req.user.roles from DB
  app.get('hook')('auth.roles').on('resolve', getUserRBACData);

  // Register group resolver — populates req.user.groups from DB
  app.get('hook')('auth.groups').on('resolve', getUserRBACData);

  // Register ownership resolver — sets req.isOwner from DB
  app.get('hook')('auth.ownership').on('resolve', getUserRBACData);

  console.info('✅ [users] Middlewares registered');

  // =========================================================================
  // ROUTING
  // =========================================================================

  const router = Router();

  // ========================================================================
  // PUBLIC ROUTES
  // ========================================================================

  // Authentication routes (public)
  router.use('/', authRoutes(app, { Router }));

  // Profile management routes (authenticated users)
  router.use('/profile', profileRoutes(app, { Router }));

  // ========================================================================
  // ADMIN ROUTES
  // ========================================================================

  // User administration routes: /admin/users
  router.use('/admin/users', userRoutes(app, { Router }));

  // Role management routes: /admin/roles
  router.use('/admin/roles', roleRoutes(app, { Router }));

  // Permission management routes: /admin/permissions
  router.use('/admin/permissions', permissionRoutes(app, { Router }));

  // Group management routes: /admin/groups
  router.use('/admin/groups', groupRoutes(app, { Router }));

  // Mount users module routes on the main API router at root level
  apiRouter.use(router);
}
