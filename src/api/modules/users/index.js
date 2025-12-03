/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userMiddlewares from './middlewares';
import { authRoutes, profileRoutes, rbacRoutes } from './routes';

/**
 * Users Module Migrations Context
 */
const migrationsContext = require.context('./migrations', false, /\.js$/);

/**
 * Users Module Seeds Context
 */
const seedsContext = require.context('./seeds', false, /\.js$/);

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
 * @param {Object} deps.Model - Sequelize instance for database operations
 * @param {Object} deps.models - Sequelize models (User, UserProfile, Role, Permission, etc.)
 * @param {Object} deps.jwtConfig - JWT configuration
 * @param {string} deps.jwtConfig.secret - JWT secret key for signing tokens
 * @param {string} deps.jwtConfig.expiresIn - JWT expiration time (e.g., '7d')
 * @param {Object} app - Express app instance (for accessing app-level settings and middleware)
 * @returns {Router} Express router with user routes mounted at /users
 *
 * @example
 * // Called by API bootstrap during module discovery
 * const userRouter = userModule(
 *   { Router, db, models, jwtConfig },
 *   app
 * );
 * // Router will be mounted at /api/users
 *
 * @example
 * // Other modules can access user userMiddlewares
 * const userMiddlewares = req.app.get('userMiddlewares');
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
  app.set('userMiddlewares', userMiddlewares);

  // Create single router instance for user routes
  const router = Router();

  // ========================================================================
  // MOUNT SEPARATED ROUTE MODULES
  // ========================================================================

  // Authentication routes (public)
  // Handles: /login, /register, /logout, /me
  router.use('/', authRoutes(deps, userMiddlewares, app));

  // Profile management routes (authenticated users)
  // Handles: /profile, /profile/avatar, /profile/password
  router.use('/', profileRoutes(deps, userMiddlewares, app));

  // Admin routes (RBAC + User Administration)
  // Handles: /admin/roles, /admin/permissions, /admin/groups, /admin/users/list, /admin/users/:id
  router.use('/admin', rbacRoutes(deps, userMiddlewares, app));

  console.info('✅ User module loaded with modular routes');

  return router;
}
