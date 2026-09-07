/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { register } from '../../shutdown.js';

import FileBroker from './adapters/file.js';
import MemoryBroker from './adapters/memory.js';
import RedisBroker from './adapters/redis.js';
import { InvalidBrokerTypeError } from './errors.js';

/**
 * Supported broker adapter types
 * @typedef {'memory' | 'file' | 'redis'} BrokerType
 */

/**
 * How many adapters this module evaluation has built.
 *
 * The shutdown registry is keyed by name and `Map.set` is deliberately
 * idempotent, so an HMR re-evaluation overwrites the previous handler
 * instead of stacking one. That also means a *second* adapter registering
 * under a bare `'broker'` would silently replace the singleton's handler,
 * and the singleton's Redis connections would never be closed at exit.
 *
 * Numbering by creation order keeps both properties: the singleton is always
 * the first adapter built in an evaluation and so always takes `'broker'`,
 * while extra instances get stable suffixes that a re-evaluation reuses
 * rather than accumulates.
 */
let instances = 0;

/**
 * Pick an adapter from the environment.
 *
 * An explicit `XNAPIFY_BROKER_TYPE` always wins — including choosing
 * `memory` on a host that has Redis configured — because the operator
 * saying which transport to use is better information than an inference
 * from another variable's presence.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {BrokerType}
 */
function detectType(env = process.env) {
  const declared =
    typeof env.XNAPIFY_BROKER_TYPE === 'string'
      ? env.XNAPIFY_BROKER_TYPE.trim()
      : '';
  if (declared) return declared;
  return RedisBroker.isConfigured(env) ? 'redis' : 'memory';
}

/**
 * @param {number} index - Creation order within this module evaluation
 * @returns {string} Shutdown registry key
 */
function shutdownKeyFor(index) {
  return index === 0 ? 'broker' : `broker:${index}`;
}

/**
 * Every method below is REQUIRED, including on a pub/sub-only adapter: the
 * singleton facade in `lazy.js` forwards each one unconditionally, so an
 * adapter that omits any of them fails with a TypeError on first use. An
 * adapter with nothing to offer for a method still implements it and reports
 * so honestly — see `MemoryBroker`, where `getClient()` is `null`,
 * `getKeyPrefix()` is `''` and `channel(name)` passes the name through.
 *
 * @typedef {Object} BrokerAdapter
 * @property {() => boolean} isConfigured - Whether a real backend is configured
 * @property {(channel: string, payload: string) => Promise<void>} publish
 * @property {(channel: string, onMessage: (payload: string) => void) => Promise<() => Promise<void>>} subscribe
 *   Resolves once the subscription is confirmed; MUST resolve to an
 *   unsubscribe function (`attachPubSub` rejects an adapter that does not).
 * @property {() => import('ioredis').Redis|null} getClient - Raw client
 *   escape hatch for KV/lock-shaped consumers (cache, rate limiting,
 *   revocation, schedule lock). `null` on adapters with no such backend.
 * @property {(name: string) => string} channel - Namespace a logical channel
 *   name for this deployment
 * @property {() => string} getKeyPrefix - The namespace prefix in effect
 * @property {(callback: () => void) => () => void} onReconnect - Subscribe to
 *   backend reconnects; returns a function that stops listening
 * @property {(callback: () => void) => () => void} onDisconnect - Subscribe to
 *   the backend connection dying for good, so a consumer holding a
 *   subscription can drop it and re-attach instead of going quietly deaf;
 *   returns a function that stops listening
 * @property {() => Promise<void>} [cleanup] - Optional; released at shutdown
 */

/**
 * Broker Factory
 *
 * Creates a pub/sub broker instance with the specified adapter. Consumers
 * depend only on the `BrokerAdapter` interface, never on a specific client
 * library — that is what lets `type: 'redis'` be swapped for a different
 * broker technology (or `getClient()` simply be unavailable) without
 * touching a single consumer.
 *
 * When `type` is omitted the adapter is chosen from the environment, in this
 * order: an explicit `XNAPIFY_BROKER_TYPE`, then `redis` when
 * `XNAPIFY_REDIS_URL` is set, then `memory`. `file` is never auto-detected —
 * a data directory alone cannot say whether the other processes sharing this
 * host are meant to hear these messages, so it is opt-in through
 * `XNAPIFY_BROKER_TYPE=file`. This mirrors how the `queue` engine's own
 * singleton reads `XNAPIFY_QUEUE_TYPE`, and lets `container.resolve('broker')`
 * "just work" without the bootstrap layer wiring a type explicitly.
 *
 * @param {Object} [options]
 * @param {BrokerType} [options.type] - Adapter type; auto-detected if omitted
 * @param {NodeJS.ProcessEnv} [options.env] - Environment for detection and
 *   for the `redis`/`file` adapters
 * @returns {BrokerAdapter}
 * @throws {InvalidBrokerTypeError} If an unsupported type is requested
 */
export function createFactory(options = {}) {
  const { type, ...config } = options;
  const resolvedType = type || detectType(config.env);

  let adapter;
  switch (resolvedType) {
    case 'memory':
      adapter = new MemoryBroker(config);
      break;

    case 'file':
      adapter = new FileBroker(config);
      break;

    case 'redis':
      adapter = new RedisBroker(config);
      break;

    default:
      throw new InvalidBrokerTypeError(resolvedType);
  }

  if (typeof adapter.cleanup === 'function') {
    register(shutdownKeyFor(instances++), () => adapter.cleanup());
  }

  return adapter;
}
