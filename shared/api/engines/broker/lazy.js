/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Deferred adapter selection for the broker singleton.
 *
 * `createFactory()` picks its adapter from `XNAPIFY_REDIS_URL`, and the
 * engine singleton is built while `shared/api/index.js` is evaluating its
 * `import.meta.webpackContext` over `engines/*` — module-evaluation time.
 * Reading the environment *there* would freeze the decision before the
 * environment is necessarily complete: `src/server.js` loads
 * `dotenv-flow/config` as its first import, but the `*.worker.js` bundles
 * are separate rspack entries that never import it, and a test or an HMR
 * re-evaluation can equally observe a different `process.env` than the one
 * in effect when the engine is first used.
 *
 * The failure that would cause is silent and security-relevant: the broker
 * would sit on the `memory` adapter for the life of the process, so the
 * cache, rate-limit counters and — critically — the session revocation set
 * would each stay per-worker, and a revoked session would remain live on
 * every worker but the one that revoked it. `shared/config/env.js` refuses
 * to cluster without `XNAPIFY_REDIS_URL` precisely to prevent that state,
 * and it validates the environment at call time, so an import-time snapshot
 * here could defeat a check that reads as passing.
 *
 * The previous `redis` engine had no such window: every entry point
 * (`isRedisConfigured`, `getRedisClient`, ...) took `env = process.env` and
 * read it per call. This facade restores that property — nothing touches
 * the environment until the first actual use — while keeping
 * `createFactory({ type })` available for explicit construction.
 */

import { createFactory } from './factory.js';

/**
 * Wrap `createFactory` so the adapter is resolved on first use, then reused.
 *
 * @param {Object} [options] - Passed to `createFactory` at resolution time
 * @returns {Object} Broker facade implementing the adapter interface
 */
export function createLazyBroker(options = {}) {
  let adapter = null;

  const resolve = () => {
    if (!adapter) adapter = createFactory(options);
    return adapter;
  };

  return {
    /** The resolved adapter — resolves it if needed. Diagnostics and tests. */
    get adapter() {
      return resolve();
    },

    isConfigured: () => resolve().isConfigured(),
    getClient: () => resolve().getClient(),
    getKeyPrefix: () => resolve().getKeyPrefix(),
    channel: name => resolve().channel(name),
    publish: (channel, payload) => resolve().publish(channel, payload),
    subscribe: (channel, onMessage) => resolve().subscribe(channel, onMessage),
    onReconnect: callback => resolve().onReconnect(callback),
    onDisconnect: callback => resolve().onDisconnect(callback),

    /** No adapter resolved means nothing was ever opened to close. */
    cleanup: () => (adapter ? adapter.cleanup() : Promise.resolve()),
  };
}

export default createLazyBroker;
