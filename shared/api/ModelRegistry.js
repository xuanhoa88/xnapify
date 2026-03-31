/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * ModelRegistry — a sealed container for Sequelize models.
 *
 * After core modules register their models during autoloader boot,
 * `seal()` locks those names so extensions cannot overwrite them.
 * Extensions add models via `register()` and remove via `unregister()`.
 *
 * A Proxy wraps the instance so property access (`registry.User`)
 * and destructuring (`const { User } = registry`) work transparently.
 *
 * @example
 * const registry = new ModelRegistry(db);
 * await registry.discover(modelsContext, 'posts');
 * registry.associate();
 * registry.seal();
 *
 * // Access (backwards-compatible)
 * const { User, Post } = registry;
 */

import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

const TAG = 'ModelRegistry';

/** @type {symbol} Internal models map */
const MODELS = Symbol('__xnapify.model.registry__');

/** @type {symbol} Set of sealed (core) model names */
const CORE_KEYS = Symbol('__xnapify.model.coreKeys__');

/** @type {symbol} Set of already-associated model names */
const ASSOCIATED = Symbol('__xnapify.model.associated__');

/** @type {symbol} Map of source → registered model names */
const SOURCE_MAP = Symbol('__xnapify.model.sourceMap__');

/** @type {symbol} Database engine reference */
const DB_ENGINE = Symbol('__xnapify.model.dbEngine__');

function log(message, level = 'info') {
  const prefix = `[${TAG}]`;
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

class ModelRegistry {
  /**
   * @param {Object} [db] - Database engine with `connection` and `DataTypes`
   */
  constructor(db) {
    /** @type {Map<string, Object>} */
    this[MODELS] = new Map();

    /** @type {Set<string>} */
    this[CORE_KEYS] = new Set();

    /** @type {Set<string>} */
    this[ASSOCIATED] = new Set();

    /** @type {Map<string, string[]>} source → model names */
    this[SOURCE_MAP] = new Map();

    /** @type {Object|null} */
    this[DB_ENGINE] = db || null;

    // Return a Proxy so `registry.User` and `const { User } = registry` work
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Prioritise own methods / properties
        if (prop in target || typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }
        // Fall through to models map
        return target[MODELS].get(prop);
      },

      set(target, prop, value) {
        if (typeof prop === 'symbol') {
          target[prop] = value;
          return true;
        }
        // Direct property assignment → delegate to register (non-strict)
        target.register(prop, value);
        return true;
      },

      has(target, prop) {
        if (typeof prop === 'symbol' || prop in target) return true;
        return target[MODELS].has(prop);
      },

      ownKeys(target) {
        return [...Reflect.ownKeys(target), ...target[MODELS].keys()];
      },

      getOwnPropertyDescriptor(target, prop) {
        if (target[MODELS].has(prop)) {
          return {
            configurable: true,
            enumerable: true,
            value: target[MODELS].get(prop),
            writable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }

  // ===========================================================================
  // REGISTRATION
  // ===========================================================================

  /**
   * Register a model.
   *
   * @param {string} name - Model name (e.g. 'User', 'Post')
   * @param {Object} model - Sequelize model instance
   * @throws {Error} If name is a sealed core model
   */
  register(name, model) {
    if (this[CORE_KEYS].has(name)) {
      const error = new Error(
        `Cannot overwrite core model "${name}". Core models are sealed.`,
      );
      error.name = 'CoreModelError';
      error.code = 'E_CORE_MODEL_SEALED';
      throw error;
    }

    this[MODELS].set(name, model);
  }

  /**
   * Remove a model or all models from a source.
   *
   * - If `name` matches a source in SOURCE_MAP, removes all its models.
   * - Otherwise removes the single model by name.
   *
   * @param {string} name - Model name or source identifier
   * @returns {boolean|string[]} True/removed names, or false if not found
   * @throws {Error} If name is a sealed core model
   */
  unregister(name) {
    // Source-based removal (e.g. extension ID)
    if (this[SOURCE_MAP].has(name)) {
      const modelNames = this[SOURCE_MAP].get(name);
      const removed = [];
      for (const modelName of modelNames) {
        if (this[MODELS].delete(modelName)) {
          this[ASSOCIATED].delete(modelName);
          removed.push(modelName);
        }
      }
      this[SOURCE_MAP].delete(name);
      return removed;
    }

    // Single model removal
    if (this[CORE_KEYS].has(name)) {
      const error = new Error(
        `Cannot unregister core model "${name}". Core models are sealed.`,
      );
      error.name = 'CoreModelError';
      error.code = 'E_CORE_MODEL_SEALED';
      throw error;
    }

    this[ASSOCIATED].delete(name);
    return this[MODELS].delete(name);
  }

  // ===========================================================================
  // BULK LOADING
  // ===========================================================================

  /**
   * Discover and register models from a webpack `require.context`.
   *
   * Factory calls run in parallel via `Promise.allSettled` for performance.
   * Registration is sequential to correctly detect duplicates.
   *
   * @param {Object} context - Webpack require.context
   * @param {string} [source='unknown'] - Source name for logging
   * @returns {Promise<{ registered: string[], errors: Object[] }>}
   */
  async discover(context, source = 'unknown') {
    const db = this[DB_ENGINE];
    if (!db || !context) return { registered: [], errors: [] };

    // Idempotent: skip if this source was already discovered
    if (this[SOURCE_MAP].has(source)) {
      return { registered: [], errors: [] };
    }

    const registered = [];
    const errors = [];
    const adapter = createWebpackContextAdapter(context);

    // Filter valid keys
    const keys = adapter.files().filter(key => {
      const fileName = key.split('/').pop();
      return (
        !/^index\.[cm]?[jt]s$/i.test(fileName) &&
        !/\.(test|spec)\.[cm]?[jt]s$/i.test(fileName)
      );
    });

    // Load and invoke all factories in parallel
    const results = await Promise.allSettled(
      keys.map(async key => {
        const mod = adapter.load(key);
        const factory = mod.default || mod;

        if (typeof factory !== 'function') {
          log(
            `[${source}] "${key}" does not export a factory function`,
            'warn',
          );
          return null;
        }

        const model = await factory(db);

        if (!model) {
          log(`[${source}] "${key}" did not return a valid object`, 'warn');
          return null;
        }
        if (!model.name) {
          log(
            `[${source}] "${key}" returned an object without a name property`,
            'warn',
          );
          return null;
        }

        return model;
      }),
    );

    // Register results sequentially (duplicate detection requires order)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === 'rejected') {
        const error = result.reason;
        errors.push({
          moduleName: source,
          path: keys[i],
          message: error.message || String(error),
          stack: error.stack,
        });
        log(`[${source}] ${error.message}`, 'error');
        continue;
      }

      const model = result.value;
      if (!model) continue;

      // Silently skip models already registered by another source
      if (this[MODELS].has(model.name)) continue;

      this.register(model.name, model);
      registered.push(model.name);
    }

    // Track source regardless of whether models were registered —
    // an empty source still counts as "discovered" for idempotency
    const existing = this[SOURCE_MAP].get(source) || [];
    this[SOURCE_MAP].set(source, [...existing, ...registered]);

    return { registered, errors };
  }

  // ===========================================================================
  // ASSOCIATIONS
  // ===========================================================================

  /**
   * Run `associate()` on all registered models.
   *
   * Passes `this` (the Proxy) so models can reference each other
   * via `registry.User`, `registry.Post`, etc.
   *
   * @returns {Object[]} Array of errors (empty if none)
   */
  associate() {
    const errors = [];

    for (const modelName of this[MODELS].keys()) {
      // Skip models that have already been associated
      if (this[ASSOCIATED].has(modelName)) continue;

      const model = this[MODELS].get(modelName);
      if (typeof model.associate !== 'function') {
        this[ASSOCIATED].add(modelName);
        continue;
      }

      try {
        model.associate(this);
        this[ASSOCIATED].add(modelName);
      } catch (error) {
        errors.push({
          moduleName: modelName,
          path: `${modelName}.associate()`,
          message: error.message || String(error),
          stack: error.stack,
        });
        log(
          `[${modelName}] Failed to initialize associations: ${error.message}`,
          'error',
        );
      }
    }

    return errors;
  }

  // ===========================================================================
  // SEALING
  // ===========================================================================

  /**
   * Seal current model names as core (immutable).
   * One-time operation — only the first call takes effect.
   * Subsequent calls (e.g. from extensions) are silently ignored.
   */
  seal() {
    if (this[CORE_KEYS].size > 0) return;

    for (const name of this[MODELS].keys()) {
      this[CORE_KEYS].add(name);
    }
  }

  // ===========================================================================
  // INSPECTION
  // ===========================================================================

  /**
   * Check if a model exists.
   *
   * @param {string} name - Model name
   * @returns {boolean}
   */
  has(name) {
    return this[MODELS].has(name);
  }

  /**
   * Get a model by name.
   *
   * @param {string} name - Model name
   * @returns {Object|undefined}
   */
  get(name) {
    return this[MODELS].get(name);
  }

  /**
   * Get all registered model names.
   *
   * @returns {string[]}
   */
  names() {
    return Array.from(this[MODELS].keys());
  }

  /**
   * Check if a model name is a sealed core model.
   *
   * @param {string} name - Model name
   * @returns {boolean}
   */
  isCore(name) {
    return this[CORE_KEYS].has(name);
  }

  /**
   * Get the total number of registered models.
   *
   * @returns {number}
   */
  get size() {
    return this[MODELS].size;
  }
}

export default ModelRegistry;
