/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as rbacCache from '../utils/rbac/cache';
import { collectUserRBACData } from '../utils/rbac/collector';

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
  const userId = req.user.id;
  const { app } = req;

  // Check cache first
  const cached = rbacCache.getUser(userId, app.get('cache'));
  if (cached) {
    // Attach cached data to request
    req.user = {
      ...req.user,
      ...cached,
    };
    return cached;
  }

  // Get models from app context
  const models = app.get('models');
  if (!models) {
    const error = new Error('Database models not available');
    error.name = 'DatabaseModelsNotFoundError';
    error.code = 'DATABASE_MODELS_NOT_FOUND';
    error.status = 500;
    throw error;
  }

  const { User, Role, Group, Permission } = models;

  // Fetch from database with full RBAC associations
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

  // Collect and cache RBAC data
  const rbacData = collectUserRBACData(user);
  rbacCache.setUser(userId, rbacData, app.get('cache'));

  // Attach to request
  req.user = {
    ...req.user,
    ...rbacData,
  };

  return rbacData;
}
