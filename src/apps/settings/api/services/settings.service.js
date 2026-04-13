/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { LRUCache } from 'lru-cache';

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

/** Max entries for single-key lookups (namespace.key → coerced value) */
const SINGLE_CACHE_MAX = 1000;

/**
 * TTL for single-key lookups (ms).
 * 5 minutes is an optimal sweet-spot: it achieves a near 100% cache hit rate
 * for busy requests, while ensuring that multi-process clusters eventually
 * sync up if a setting is changed in another node.
 */
const SINGLE_CACHE_TTL = 5 * 60 * 1000; // 5 mins

/** Max entries for collection queries (getAll, getPublic, getByNamespace) */
const COLLECTION_CACHE_MAX = 100;

/**
 * TTL for collection queries (ms)
 * 1 minute ensures the admin UI and public frontend endpoints load instantly
 * but reflect new grouped configurations very quickly.
 */
const COLLECTION_CACHE_TTL = 60 * 1000; // 1 min

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Settings Service Factory
 *
 * Provides a unified API for reading and writing global settings.
 * Resolves values with a fallback chain: DB value → process.env → null.
 * Uses LRU caching to avoid repeated DB queries on hot paths.
 *
 * @param {Object} container - DI container instance
 * @returns {Object} Settings service API
 */
export function createSettingsService(container) {
  // ── Caches ────────────────────────────────────────────────────────────────

  /** Cache for single get(namespace, key) → coerced value */
  const singleCache = new LRUCache({
    max: SINGLE_CACHE_MAX,
    ttl: SINGLE_CACHE_TTL,
  });

  /** Cache for collection queries (getAll, getPublic, getByNamespace) */
  const collectionCache = new LRUCache({
    max: COLLECTION_CACHE_MAX,
    ttl: COLLECTION_CACHE_TTL,
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolve the raw DB value into a typed value based on row metadata.
   *
   * @param {Object} row - Setting model instance
   * @returns {string|null} Resolved value
   */
  function resolveValue(row) {
    // 1. DB value takes priority
    if (row.value != null) {
      return row.value;
    }

    // 2. Fallback to process.env
    if (row.default_env_var) {
      const envVal = process.env[row.default_env_var];
      if (envVal !== undefined) {
        return envVal;
      }
    }

    // 3. No value available
    return null;
  }

  /**
   * Coerce a raw string value to its declared type.
   *
   * @param {string|null} rawValue - Raw string value
   * @param {string} type - Declared type (string, boolean, integer, json, password)
   * @returns {*} Coerced value
   */
  function coerce(rawValue, type) {
    if (rawValue == null) return null;

    switch (type) {
      case 'boolean':
        return rawValue === 'true' || rawValue === '1';
      case 'integer':
        return parseInt(rawValue, 10) || 0;
      case 'json':
        try {
          return JSON.parse(rawValue);
        } catch {
          return null;
        }
      default:
        return rawValue;
    }
  }

  /**
   * Format a row for API responses (includes resolved value).
   *
   * @param {Object} row - Setting model instance
   * @returns {Object} Formatted setting
   */
  function formatRow(row) {
    const rawValue = resolveValue(row);
    return {
      id: row.id,
      namespace: row.namespace,
      key: row.key,
      type: row.type,
      value: rawValue,
      coerced: coerce(rawValue, row.type),
      isDefault: row.value == null,
      defaultEnvVar: row.default_env_var,
      isPublic: row.is_public,
      description: row.description,
    };
  }

  /**
   * Invalidate cache entries affected by a write to (namespace, key).
   *
   * @param {string} namespace
   * @param {string} key
   */
  function invalidate(namespace, key) {
    singleCache.delete(`${namespace}.${key}`);
    // Purge all collection caches since any write could affect grouping
    collectionCache.clear();
  }

  /**
   * Sync a changed setting back to process.env for live hot-reloading compatibility.
   * Note: Enforces string values to maintain pure Node.js compatibility.
   */
  function syncToEnv(row) {
    if (row.default_env_var && row.value != null) {
      process.env[row.default_env_var] = String(row.value);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    /**
     * Get a single setting value (resolved, coerced).
     * Results are cached for up to 30s.
     *
     * @param {string} namespace - Module namespace
     * @param {string} key - Setting key
     * @returns {Promise<*>} Coerced value or null
     */
    async get(namespace, key) {
      const cacheKey = `${namespace}.${key}`;

      if (singleCache.has(cacheKey)) {
        return singleCache.get(cacheKey);
      }

      const { Setting } = container.resolve('models');
      const row = await Setting.findOne({ where: { namespace, key } });

      if (!row) {
        // Cache miss-as-null to avoid repeated DB queries for unknown keys
        singleCache.set(cacheKey, null);
        return null;
      }

      const result = coerce(resolveValue(row), row.type);
      singleCache.set(cacheKey, result);
      return result;
    },

    /**
     * Get settings, optionally filtered by a namespace.
     * If a namespace is provided, returns an Array of settings.
     * If no namespace is provided, returns a Map of settings grouped by namespace.
     * Results are cached for up to 1 minute.
     *
     * @param {string} [namespace] - Optional module namespace
     * @returns {Promise<Object[]|Object>}
     */
    async getAll(namespace) {
      const cacheKey = namespace ? `ns:${namespace}` : 'all';

      if (collectionCache.has(cacheKey)) {
        return collectionCache.get(cacheKey);
      }

      const { Setting } = container.resolve('models');

      if (namespace) {
        const rows = await Setting.findAll({
          where: { namespace },
          order: [['key', 'ASC']],
        });
        const result = rows.map(formatRow);
        collectionCache.set(cacheKey, result);
        return result;
      }

      const rows = await Setting.findAll({
        order: [
          ['namespace', 'ASC'],
          ['key', 'ASC'],
        ],
      });

      const grouped = {};
      for (const row of rows) {
        if (!grouped[row.namespace]) {
          grouped[row.namespace] = [];
        }
        grouped[row.namespace].push(formatRow(row));
      }

      collectionCache.set(cacheKey, grouped);
      return grouped;
    },

    /**
     * Get all public settings (for client consumption).
     * Results are cached for up to 10s.
     *
     * @returns {Promise<Object>} Map of "namespace.key" → coerced value
     */
    async getPublic() {
      const cacheKey = 'public';

      if (collectionCache.has(cacheKey)) {
        return collectionCache.get(cacheKey);
      }

      const { Setting } = container.resolve('models');
      const rows = await Setting.findAll({
        where: { is_public: true },
        order: [
          ['namespace', 'ASC'],
          ['key', 'ASC'],
        ],
      });

      const result = {};
      for (const row of rows) {
        const rawValue = resolveValue(row);
        result[`${row.namespace}.${row.key}`] = coerce(rawValue, row.type);
      }

      collectionCache.set(cacheKey, result);
      return result;
    },

    /**
     * Set a single setting value.
     * Invalidates affected cache entries.
     *
     * @param {string} namespace - Module namespace
     * @param {string} key - Setting key
     * @param {string|null} value - New value (null resets to env fallback)
     * @returns {Promise<Object>} Updated setting
     */
    async set(namespace, key, value) {
      const { Setting } = container.resolve('models');
      const row = await Setting.findOne({ where: { namespace, key } });

      if (!row) {
        const err = new Error(`Setting not found: ${namespace}.${key}`);
        err.name = 'SettingNotFoundError';
        err.status = 404;
        throw err;
      }

      row.value = value;
      await row.save();
      invalidate(namespace, key);
      syncToEnv(row);
      return formatRow(row);
    },

    /**
     * Bulk update settings.
     * Invalidates all affected cache entries.
     *
     * @param {Array<{namespace: string, key: string, value: string|null}>} updates
     * @returns {Promise<Object[]>} Updated settings
     */
    async bulkUpdate(updates) {
      const { Setting } = container.resolve('models');
      const { sequelize } = Setting;
      const results = [];
      await sequelize.transaction(async transaction => {
        for (const update of updates) {
          const row = await Setting.findOne({
            where: { namespace: update.namespace, key: update.key },
            transaction,
          });

          if (!row) {
            const err = new Error(
              `Setting not found: ${update.namespace}.${update.key}`,
            );
            err.name = 'SettingNotFoundError';
            err.status = 404;
            throw err;
          }

          row.value = update.value;
          await row.save({ transaction });
          results.push({ row, formatted: formatRow(row) });
        }
      });

      // Invalidate cache and sync to process.env after successful transaction commit
      for (const result of results) {
        invalidate(result.formatted.namespace, result.formatted.key);
        syncToEnv(result.row);
      }
      return results.map(r => r.formatted);
    },

    /**
     * Clear all caches. Useful after migrations or manual DB changes.
     */
    clearCache() {
      singleCache.clear();
      collectionCache.clear();
    },

    /**
     * Get a scoped API for a specific namespace.
     * Useful for developer convenience inside modules.
     *
     * @example
     * const authSettings = settings.withNamespace('auth');
     * const ttl = await authSettings.get('SESSION_TTL');
     *
     * @param {string} namespace - The module namespace to scope to
     * @returns {Object} Scoped API with get() and set() methods
     */
    withNamespace(namespace) {
      // Capture the parent reference to call the unified set/get
      const parent = this;
      return {
        get: key => parent.get(namespace, key),
        set: (key, value) => parent.set(namespace, key, value),
      };
    },
  };
}
