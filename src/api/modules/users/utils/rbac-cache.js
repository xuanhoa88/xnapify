/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// RBAC CACHE UTILITY
// ========================================================================

/**
 * In-memory cache for user RBAC data (roles and permissions).
 * Reduces database queries for authorization checks.
 */

// Cache configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache storage: Map<userId, { roles: string[], permissions: string[], groups: object[], expiresAt: number }>
const cache = new Map();

/**
 * Get cached RBAC data for a user
 *
 * @param {string} userId - User ID
 * @returns {Object|null} Cached data or null if not found/expired
 */
export function getCachedUserRBAC(userId) {
  if (!userId) return null;

  const cached = cache.get(userId);
  if (!cached) return null;

  // Check if expired
  if (Date.now() > cached.expiresAt) {
    cache.delete(userId);
    return null;
  }

  return {
    roles: cached.roles,
    permissions: cached.permissions,
    groups: cached.groups,
  };
}

/**
 * Set cached RBAC data for a user
 *
 * @param {string} userId - User ID
 * @param {Object} data - RBAC data to cache
 * @param {string[]} data.roles - User's role names
 * @param {string[]} data.permissions - User's permission names
 * @param {Object[]} data.groups - User's groups
 * @param {number} [ttl=DEFAULT_TTL] - Time to live in milliseconds
 */
export function setCachedUserRBAC(userId, data, ttl = DEFAULT_TTL) {
  if (!userId || !data) return;

  cache.set(userId, {
    roles: data.roles || [],
    permissions: data.permissions || [],
    groups: data.groups || [],
    expiresAt: Date.now() + ttl,
  });
}

/**
 * Invalidate cache for a specific user
 *
 * @param {string} userId - User ID to invalidate
 */
export function invalidateUserCache(userId) {
  if (userId) {
    cache.delete(userId);
  }
}

/**
 * Invalidate cache for multiple users
 *
 * @param {string[]} userIds - Array of user IDs to invalidate
 */
export function invalidateUsersCache(userIds) {
  if (Array.isArray(userIds)) {
    userIds.forEach(userId => cache.delete(userId));
  }
}

/**
 * Invalidate all cached RBAC data
 * Use when making global permission changes (e.g., role permission updates)
 */
export function invalidateAllCache() {
  cache.clear();
}

/**
 * Get cache statistics for monitoring
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  let validCount = 0;
  let expiredCount = 0;
  const now = Date.now();

  cache.forEach(value => {
    if (now > value.expiresAt) {
      expiredCount++;
    } else {
      validCount++;
    }
  });

  return {
    totalEntries: cache.size,
    validEntries: validCount,
    expiredEntries: expiredCount,
  };
}

/**
 * Clean up expired entries (can be called periodically)
 *
 * @returns {number} Number of entries removed
 */
export function cleanupExpiredCache() {
  const now = Date.now();
  let removed = 0;

  cache.forEach((value, key) => {
    if (now > value.expiresAt) {
      cache.delete(key);
      removed++;
    }
  });

  return removed;
}

/**
 * Helper: Collect effective roles and permissions from user data
 *
 * @param {Object} user - User with roles and groups associations
 * @returns {Object} Object with roles and permissions arrays
 */
export function collectUserRBACData(user) {
  const rolesSet = new Set();
  const permissionsSet = new Set();
  const groups = [];

  // Collect from direct roles
  if (user.roles) {
    user.roles.forEach(role => {
      rolesSet.add(role.name);
      if (role.permissions) {
        role.permissions.forEach(perm => permissionsSet.add(perm.name));
      }
    });
  }

  // Collect from group-inherited roles
  if (user.groups) {
    user.groups.forEach(group => {
      groups.push({
        id: group.id,
        name: group.name,
        category: group.category,
        type: group.type,
      });
      if (group.roles) {
        group.roles.forEach(role => {
          rolesSet.add(role.name);
          if (role.permissions) {
            role.permissions.forEach(perm => permissionsSet.add(perm.name));
          }
        });
      }
    });
  }

  return {
    roles: Array.from(rolesSet),
    permissions: Array.from(permissionsSet),
    groups,
  };
}
