/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as userMiddlewares from './middlewares';
import {
  authRoutes,
  profileRoutes,
  userAdminRoutes,
  rbacRoutes,
  demoRoutes,
} from './routes';

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
 * - Authentication: POST /users/register, POST /users/login, POST /users/logout, GET /users/me
 * - Profile: GET /users/profile, PUT /users/profile, POST /users/avatar, PUT /users/password
 * - Administration: GET /users/list, GET /users/:id, PUT /users/:id, DELETE /users/:id
 * - RBAC: POST /users/roles, GET /users/permissions, PUT /users/:id/roles
 * - Demo: GET /users/admin/dashboard, GET /users/team/workspace
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

  // Authentication routes (public and authenticated)
  // Handles: /users/register, /users/login, /users/logout, /users/me
  router.use('/users', authRoutes(deps, userMiddlewares, app));

  // Profile management routes (authenticated users)
  // Handles: /users/profile, /users/avatar, /users/password
  router.use('/users', profileRoutes(deps, userMiddlewares, app));

  // User administration routes (admin only)
  // Handles: /users/list, /users/:id, /users/:id/role, /users/:id/status
  router.use('/users', userAdminRoutes(deps, userMiddlewares, app));

  // RBAC management routes (permission-based)
  // Handles: /users/roles, /users/permissions, /users/groups, /users/initialize
  router.use('/users', rbacRoutes(deps, userMiddlewares, app));

  // Demo and example routes
  // Handles: /users/admin/dashboard, /users/team/workspace, /users/developer/tools
  router.use('/users', demoRoutes(deps, userMiddlewares, app));

  console.info('✅ User module loaded with modular routes');

  return router;
}
