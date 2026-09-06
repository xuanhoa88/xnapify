/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Deployment-wide leader lease for scheduled tasks.
 *
 * `isSingletonWorker()` only dedupes within one host: every container behind
 * a load balancer thinks it is the singleton, so a cron registered by four
 * containers fires four times. This lease moves the decision into Redis —
 * the first instance to win `SET <key> <id> PX <ttl> NX` for a tick runs it,
 * everyone else skips.
 *
 * The lease is deliberately short-lived and never released: it only needs to
 * outlive the spread between instances firing the same tick, not the job.
 * A crash therefore cannot wedge a schedule.
 */

import { randomUUID } from 'crypto';

/** Shortest lease that still absorbs clock spread between instances. */
const MIN_TTL_MS = 1_000;

/**
 * Build a lease acquirer backed by Redis.
 *
 * @param {Object} client - ioredis-compatible client (needs `set`)
 * @param {Object} [options]
 * @param {string} [options.prefix='schedule:lease:'] - Key namespace
 * @param {string} [options.instanceId] - Value stored for debugging
 * @returns {(name: string, ttlMs: number) => Promise<boolean>}
 */
export function createRedisScheduleLock(
  client,
  {
    prefix = 'schedule:lease:',
    instanceId = `${process.pid}:${randomUUID()}`,
  } = {},
) {
  if (!client || typeof client.set !== 'function') {
    throw new TypeError('createRedisScheduleLock requires a Redis client');
  }

  return async function acquireScheduleLease(name, ttlMs) {
    const ttl = Math.max(MIN_TTL_MS, Math.floor(ttlMs) || MIN_TTL_MS);
    const result = await client.set(
      `${prefix}${name}`,
      instanceId,
      'PX',
      ttl,
      'NX',
    );
    return result === 'OK';
  };
}

export default createRedisScheduleLock;
