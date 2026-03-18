/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import passport from 'passport';

/**
 * Dynamic OAuth provider registry.
 *
 * Plugins call `registerProvider()` during their `init()` lifecycle
 * to wire up their Passport strategy and declare their OAuth scopes.
 *
 * The `_route.js` files for `/api/auth/oauth/[provider]` use
 * `getProvider()` to look up scopes at request time.
 */
class OAuthRegistry {
  constructor() {
    /** @type {Map<string, { scope: string[] }>} */
    this.providers = new Map();
  }

  /**
   * Register an OAuth provider.
   *
   * @param {string} name       - Provider name (e.g. 'google')
   * @param {object} opts
   * @param {object} opts.strategy  - Instantiated Passport strategy
   * @param {string[]} opts.scope   - OAuth scopes for the initiate route
   */
  registerProvider(name, { strategy, scope = [] }) {
    passport.use(name, strategy);
    this.providers.set(name, { scope });
    console.info(`[OAuth] ✅ Registered provider: ${name}`);
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
  return { passport, oauth };
}

export default passport;
