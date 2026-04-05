/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacCache from './cache';
import { collectUserRBACData } from './collector';

// Track in-flight promises to prevent cache stampedes (thundering herd)
const activeFetches = new Map();

/**
 * Fetch user with full RBAC associations from DB
 *
 * @param {string} userId - User ID
 * @param {Object} models - Database models
 * @returns {Promise<Object>} User instance with roles, groups, and permissions
 */
export async function fetchUserWithRBAC(userId, models) {
  const { User, Role, Group, Permission } = models;

  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        as: 'roles',
        attributes: ['name'],
        through: { attributes: [] },
        include: [
          {
            model: Permission,
            as: 'permissions',
            attributes: ['resource', 'action'],
            where: { is_active: true },
            required: false,
            through: { attributes: [] },
          },
        ],
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['name'],
        required: false,
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: 'roles',
            attributes: ['name'],
            through: { attributes: [] },
            include: [
              {
                model: Permission,
                as: 'permissions',
                attributes: ['resource', 'action'],
                where: { is_active: true },
                required: false,
                through: { attributes: [] },
              },
            ],
          },
        ],
      },
    ],
  });

  if (!user) {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';
    error.code = 'USER_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  return user;
}

/**
 * Fetch user's complete RBAC data by ID, with caching
 *
 * @param {string} userId - User ID
 * @param {Object} context - Context containing models and cache
 * @param {Object} context.models - Database models
 * @param {Object} context.cache - Cache provider
 * @returns {Promise<Object>} Object containing { roles: string[], groups: string[], permissions: string[] }
 */
export async function fetchUserRBACData(userId, { models, cache }) {
  const cached = await rbacCache.getUser(userId, cache);
  if (cached) return cached;

  if (!models) {
    const error = new Error('Database models not available');
    error.name = 'DatabaseModelsNotFoundError';
    error.code = 'DATABASE_MODELS_NOT_FOUND';
    error.status = 500;
    throw error;
  }

  // Deduplicate concurrent requests (prevent cache stampede)
  if (!activeFetches.has(userId)) {
    const fetchPromise = (async () => {
      try {
        const user = await fetchUserWithRBAC(userId, models);
        const rbacData = collectUserRBACData(user);
        await rbacCache.setUser(userId, rbacData, cache);
        return rbacData;
      } finally {
        activeFetches.delete(userId); // ensure cleanup
      }
    })();
    activeFetches.set(userId, fetchPromise);
  }

  return activeFetches.get(userId);
}

/**
 * Get user's complete RBAC data (roles, groups, permissions) from cache or database
 *
 * This is a shared helper used by both role and permission middlewares to avoid
 * duplicating the database query logic. Fetches the entire RBAC data structure
 * and caches it for subsequent requests.
 *
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Object containing { roles: string[], groups: string[], permissions: string[] }
 * @throws {Error} If database models are not available or user is not found
 */
export async function getUserRBACData(req) {
  // If authenticated via API Key, use scopes as permissions
  // Bypass DB lookup for user roles/permissions
  if (req.authMethod === 'api_key' && req.apiKey) {
    const scopes = req.apiKey.scopes || [];
    const rbacData = {
      roles: [],
      groups: [],
      permissions: scopes,
    };

    // Attach to request
    req.user = {
      ...req.user,
      ...rbacData,
    };

    return rbacData;
  }

  const userId = req.user.id;
  const container = req.app.get('container');
  const models = container.resolve('models');
  const cache = container.resolve('cache');

  let rbacData;
  try {
    // Use consolidated fetcher
    rbacData = await fetchUserRBACData(userId, { models, cache });
  } catch (error) {
    // Never throw from a hook listener — unhandled rejections crash the server.
    // Return empty RBAC data so the permission middleware denies with 403.
    console.warn(
      `[RBAC] Failed to fetch RBAC data for user ${userId}:`,
      error.message,
    );
    rbacData = { roles: [], groups: [], permissions: [] };
  }

  // Attach to request
  req.user = {
    ...req.user,
    ...rbacData,
  };

  return rbacData;
}
