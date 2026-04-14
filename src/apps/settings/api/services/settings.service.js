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

/** Max entries for collection queries (getAll, getDictionary) */
const COLLECTION_CACHE_MAX = 100;

/**
 * TTL for collection queries (ms)
 * 1 minute ensures the admin UI loads instantly
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

  /** Cache for collection queries (getAll, getDictionary) */
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
      sortOrder: row.sort_order,
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
   */
  function invalidate() {
    // Purge all collection caches since any write could affect grouping or dictionaries
    collectionCache.clear();
  }

  /**
   * Snapshot of original process.env values captured before the first
   * override for each env var. Used to restore the original fallback
   * when a setting is reset to null.
   *
   * key   = env var name (e.g. 'XNAPIFY_SMTP_HOST')
   * value = original value (string) or undefined if the var was not set
   */
  const originalEnvSnapshot = new Map();

  /**
   * Sync a changed setting back to process.env for live hot-reloading compatibility.
   * Preserves the original env value so it can be restored when the DB value is reset to null.
   */
  function syncToEnv(row) {
    if (!row.default_env_var) return;

    // Capture the original env value before the very first override
    if (!originalEnvSnapshot.has(row.default_env_var)) {
      originalEnvSnapshot.set(
        row.default_env_var,
        process.env[row.default_env_var],
      );
    }

    if (row.value != null) {
      // DB value takes precedence — propagate to process.env
      process.env[row.default_env_var] = String(row.value);
    } else {
      // Value reset to null — restore the original env var so the
      // .env / system environment variable becomes the active fallback.
      const original = originalEnvSnapshot.get(row.default_env_var);
      if (original !== undefined) {
        process.env[row.default_env_var] = original;
      } else {
        delete process.env[row.default_env_var];
      }
    }
  }

  /**
   * Internal generic dictionary factory mapping DB rows -> nested lodash objects.
   */
  async function getDictionary(isPublic = false) {
    const cacheKey = isPublic ? 'dict:public' : 'dict:all';
    if (collectionCache.has(cacheKey)) return collectionCache.get(cacheKey);

    const { Setting } = container.resolve('models');
    const where = isPublic ? { is_public: true } : {};
    const rows = await Setting.findAll({ where });

    const result = {};
    for (const row of rows) {
      const rawValue = resolveValue(row);
      result[`${row.namespace}.${row.key}`] = coerce(rawValue, row.type);
    }

    collectionCache.set(cacheKey, result);
    return result;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    /**
     * Get a single setting value via dynamic path traversal.
     * Uses memory-cached dictionary to avoid N+1 DB queries natively.
     *
     * @param {string} namespaceOrPath - Module namespace or full dot path
     * @param {string} [key] - Setting key (optional if using path)
     * @returns {Promise<*>} Coerced value or null
     */
    async get(namespaceOrPath, key) {
      const path = key ? `${namespaceOrPath}.${key}` : namespaceOrPath;
      const dict = await getDictionary(false);

      const val = dict[path];
      return val == null ? null : val;
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
          order: [
            ['sort_order', 'ASC'],
            ['key', 'ASC'],
          ],
        });
        const result = rows.map(formatRow);
        collectionCache.set(cacheKey, result);
        return result;
      }

      const rows = await Setting.findAll({
        order: [
          ['namespace', 'ASC'],
          ['sort_order', 'ASC'],
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
     * Results are cached for up to 1 minute.
     *
     * @returns {Promise<Object>} Map of "namespace.key" → coerced value
     */
    async getPublic() {
      return getDictionary(true);
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
      invalidate();
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

      // Sync to process.env after successful transaction commit
      for (const result of results) {
        syncToEnv(result.row);
      }

      // Execute a single global invalidation flush covering all updates securely
      invalidate();
      return results.map(r => r.formatted);
    },

    /**
     * Sync all DB-overridden settings to process.env at boot time.
     * Captures original env values before overriding so they can be
     * restored later if a setting is reset to null via the admin UI.
     *
     * Called once from the module's boot() lifecycle hook.
     */
    async syncBootToEnv() {
      const { Setting } = container.resolve('models');
      const rows = await Setting.findAll();

      for (const row of rows) {
        // Only sync settings that have an explicit DB value and an env var mapping.
        // syncToEnv internally snapshots the original env value before overriding.
        if (row.default_env_var && row.value != null) {
          syncToEnv(row);
        }
      }
    },

    /**
     * Clear all caches. Useful after migrations or manual DB changes.
     */
    clearCache() {
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
