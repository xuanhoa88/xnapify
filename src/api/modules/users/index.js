/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userMiddlewares from './middlewares';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import userRoutes from './routes/admin/user.routes';
import roleRoutes from './routes/admin/role.routes';
import permissionRoutes from './routes/admin/permission.routes';
import groupRoutes from './routes/admin/group.routes';

// Auto-load migrations via webpack require.context
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.js$/,
);

// Auto-load seeds via webpack require.context
const seedsContext = require.context('./database/seeds', false, /\.js$/);

/**
 * User Module Factory
 *
 * This module handles comprehensive user management including authentication,
 * profile management, user administration, and role-based access control.
 * Uses dependency injection and modular route architecture.
 *
 * Module Structure:
 * - Authentication: POST /login, POST /register, POST /logout, GET /me
 * - Profile: GET /profile, PUT /profile, POST /profile/avatar, PUT /profile/password
 * - Administration: GET /admin/users/list, GET /admin/users/:id, PUT /admin/users/:id, DELETE /admin/users/:id
 * - RBAC: POST /admin/roles, GET /admin/permissions, PUT /admin/:id/roles, GET /admin/groups
 * - Security: Password management, JWT tokens, role-based permissions
 * - Models: User, UserProfile, Role, Permission, Group
 * - Services: Authentication, profile, user-admin, role, permission, group, user-rbac
 * - Middlewares: Authentication, authorization, validation, file upload
 * - Routes: Modular route organization with focused responsibilities
 *
 * @param {Object} deps - Dependencies injected by API bootstrap
 * @param {Function} deps.Router - Express Router constructor
 * @param {Object} deps.models - Sequelize models for database operations
 * @param {Object} deps.db - Sequelize instance for database operations
 * @param {Object} app - Express app instance (for accessing app-level settings and middleware)
 * @returns {Router} Express router with user routes mounted at /users
 */
export default async function userModule(deps, app) {
  const { Router } = deps;

  // Get database instance from app settings
  const db = app.get('db');

  // Initialize database migrations
  await db.runMigrations(
    [{ context: migrationsContext, prefix: 'users' }],
    db.connection,
  );

  // Initialize database seeds
  await db.runSeeds(
    [{ context: seedsContext, prefix: 'users' }],
    db.connection,
  );

  // Register global middlewares in app settings for reuse by other modules
  app.set('user.middlewares', userMiddlewares);

  // Create single router instance for user routes
  const router = Router();

  // ========================================================================
  // PUBLIC ROUTES
  // ========================================================================

  // Authentication routes (public)
  // Handles: /login, /register, /logout, /me
  router.use('/', authRoutes(deps, userMiddlewares, app));

  // Profile management routes (authenticated users)
  // Handles: /profile, /profile/avatar, /profile/password
  router.use('/profile', profileRoutes(deps, userMiddlewares, app));

  // ========================================================================
  // ADMIN ROUTES
  // ========================================================================

  // User administration routes: /admin/users (includes dashboard, CRUD, assignments)
  router.use('/admin/users', userRoutes(deps, userMiddlewares, app));

  // Role management routes: /admin/roles
  router.use('/admin/roles', roleRoutes(deps, userMiddlewares, app));

  // Permission management routes: /admin/permissions
  router.use(
    '/admin/permissions',
    permissionRoutes(deps, userMiddlewares, app),
  );

  // Group management routes: /admin/groups
  router.use('/admin/groups', groupRoutes(deps, userMiddlewares, app));

  console.info('✅ User module loaded with modular routes');

  return router;
}
