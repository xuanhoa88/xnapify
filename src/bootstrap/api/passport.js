/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import passport from 'passport';

/**
 * Dynamic OAuth provider registry.
 *
 * Extensions call `registerProvider()` during their `boot()` lifecycle
 * to declare their OAuth provider with a lazy strategy factory.
 *
 * The strategy factory is invoked on the first request (or after
 * credentials change), so boot-time timing issues are eliminated
 * and admin settings changes take effect without a server restart.
 *
 * The `_route.js` files for `/api/auth/oauth/[provider]` call
 * `ensureStrategy()` to materialise the strategy before
 * `passport.authenticate()`.
 */
class OAuthRegistry {
  constructor() {
    /**
     * @type {Map<string, { scope: string[], strategy?: Function|object }>}
     * `strategy` may be:
     *   - a **function** (factory) — called lazily via `ensureStrategy()`
     *   - an **object** (pre-built Strategy instance) — used directly
     */
    this.providers = new Map();
  }

  /**
   * Register an OAuth provider.
   *
   * @param {string} name       - Provider name (e.g. 'google')
   * @param {object} opts
   * @param {Function|object} opts.strategy - Passport strategy instance **or**
   *   a factory `() => Strategy` that will be called lazily at request time.
   * @param {string[]} opts.scope   - OAuth scopes for the initiate route
   */
  registerProvider(name, { strategy, scope = [] }) {
    if (typeof strategy !== 'function' && typeof strategy !== 'object') {
      throw new TypeError(
        `[OAuth] strategy for "${name}" must be a factory function or a Strategy instance`,
      );
    }

    // If it's a pre-built Strategy instance (not a plain factory fn),
    // register it on Passport immediately for backwards compatibility.
    if (typeof strategy === 'object') {
      passport.use(name, strategy);
      this.providers.set(name, { scope, _materialised: true });
    } else {
      // Store the factory — it will be called on demand via ensureStrategy()
      this.providers.set(name, { scope, strategy, _materialised: false });
    }

    console.info(`[OAuth] ✅ Registered provider: ${name}`);
  }

  /**
   * Ensure the Passport strategy for `name` is materialised.
   *
   * If the provider was registered with a factory function, the factory
   * is called **once** and the resulting strategy is handed to Passport.
   * Subsequent calls are no-ops unless `force` is true (useful when
   * credentials change at runtime).
   *
   * @param {string} name  - Provider name
   * @param {boolean} [force=false] - Re-create even if already materialised
   * @returns {boolean} `true` if the strategy is ready
   */
  async ensureStrategy(name, force = false) {
    const entry = this.providers.get(name);
    if (!entry) return false;

    // eslint-disable-next-line no-underscore-dangle
    if (entry._materialised && !force) return true;

    if (typeof entry.strategy === 'function') {
      // Support both sync and async factories
      const instance = await entry.strategy();
      if (!instance) return false;
      passport.use(name, instance);
      // eslint-disable-next-line no-underscore-dangle
      entry._materialised = true;
    }

    // eslint-disable-next-line no-underscore-dangle
    return entry._materialised === true;
  }

  /**
   * Remove a previously registered OAuth provider.
   *
   * @param {string} name - Provider name to unregister
   */
  unregisterProvider(name) {
    // Passport has no built-in unuse() — remove from internal strategies map
    // eslint-disable-next-line no-underscore-dangle
    if (passport._strategy(name)) {
      // eslint-disable-next-line no-underscore-dangle
      delete passport._strategies[name];
    }
    this.providers.delete(name);
    console.info(`[OAuth] 🗑️ Unregistered provider: ${name}`);
  }

  /**
   * Look up a registered provider.
   *
   * @param {string} name - Provider name
   * @returns {{ scope: string[] } | undefined}
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Check if a provider is registered.
   *
   * @param {string} name - Provider name
   * @returns {boolean}
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * Get all registered provider names.
   *
   * @returns {string[]}
   */
  getProviderNames() {
    return [...this.providers.keys()];
  }
}

/**
 * Create and initialise the OAuth registry.
 *
 * Returns `{ passport, oauth }` — the passport instance and the registry.
 */
export function configurePassport() {
  const oauth = new OAuthRegistry();
  // Expose passport instance so the bootstrap layer can call
  // oauth.passport.initialize() without a direct dependency.
  oauth.passport = passport;
  return { passport, oauth };
}

export default passport;
