/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Broker Engine — the shared backend for multi-instance deployments,
 * exposed as a pluggable interface instead of a specific client library.
 *
 * This engine replaces what used to be a standalone `redis` engine. Two
 * kinds of consumer depend on it, and they depend on different slices of it:
 *
 * - **Pub/sub** (WebSocket cross-instance fan-out today): `publish(channel,
 *   payload)` / `subscribe(channel, onMessage)`. This half is genuinely
 *   transport-agnostic — a RabbitMQ, Kafka, or NATS adapter could implement
 *   just these two methods and fan-out would not notice the difference.
 * - **KV / atomic-mutex** (shared cache, rate-limit counters, session
 *   revocation, the cron leader lock): `getClient()` hands back the raw
 *   `ioredis` client for these to issue real Redis commands
 *   (`GET`/`SET PX`/`SCAN`, `SET NX`, ...) against. No message broker is
 *   obligated to double as a key/value store or a mutex, so this half is
 *   only ever backed by the `redis` adapter — `getClient()` returns `null`
 *   on any adapter that cannot serve it, and callers must check
 *   `isConfigured()` first.
 *
 * The default export is a singleton that auto-detects its adapter from
 * `XNAPIFY_REDIS_URL` (see `factory.js`). Both the adapter choice and the
 * connection are deferred to first use (see `lazy.js`) — importing this
 * module reads no environment and opens no socket, which is what keeps a
 * worker bundle or an HMR reload from freezing the wrong adapter in place.
 *
 * @example
 * const broker = container.resolve('broker');
 * const unsubscribe = await broker.subscribe('orders:created', payload => {
 *   console.log(JSON.parse(payload));
 * });
 * await broker.publish('orders:created', JSON.stringify({ id: 1 }));
 * await unsubscribe();
 *
 * @example
 * if (broker.isConfigured()) {
 *   const client = broker.getClient();
 *   await client.set('key', 'value', 'PX', 1000);
 * }
 */

import { createFactory } from './factory.js';
import { createLazyBroker } from './lazy.js';

export { createFactory, createLazyBroker };

export { BrokerError, InvalidBrokerTypeError } from './errors.js';

export { default as MemoryBroker } from './adapters/memory.js';
export { default as FileBroker } from './adapters/file.js';
export { default as RedisBroker } from './adapters/redis.js';

/**
 * Singleton instance of Broker Engine
 * Used by the application via app.get('container').resolve('broker')
 */
const broker = createLazyBroker();

export default broker;
