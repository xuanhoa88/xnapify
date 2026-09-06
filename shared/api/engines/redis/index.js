/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redis Engine — shared backend for multi-instance deployments.
 *
 * Every in-process store the app relies on (cache, rate limits, session
 * revocation, WebSocket channels) is per worker. When the server runs as a
 * cluster or behind a load balancer those stores must be shared, and this
 * engine provides the connection they share. It is optional: without
 * `XNAPIFY_REDIS_URL` every consumer keeps its in-memory implementation.
 *
 * Clients are created lazily so importing the engine never opens a socket.
 *
 * @example
 * const redis = container.resolve('redis');
 * if (redis.isConfigured()) {
 *   const client = redis.getClient();
 *   await client.set('key', 'value', 'PX', 1000);
 * }
 */

import Redis from 'ioredis';

import { register } from '../../shutdown.js';

const DEFAULT_PREFIX = 'xnapify:';

let client = null;
let subscriber = null;
let shutdownRegistered = false;

function log(message, level = 'info') {
  const prefix = '[Redis]';
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

/**
 * Whether a Redis URL is configured.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isRedisConfigured(env = process.env) {
  return (
    typeof env.XNAPIFY_REDIS_URL === 'string' &&
    env.XNAPIFY_REDIS_URL.trim().length > 0
  );
}

/**
 * Key prefix applied to every command (namespace per deployment).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function getRedisKeyPrefix(env = process.env) {
  const raw =
    typeof env.XNAPIFY_REDIS_PREFIX === 'string'
      ? env.XNAPIFY_REDIS_PREFIX.trim()
      : '';
  if (!raw) return DEFAULT_PREFIX;
  return raw.endsWith(':') ? raw : `${raw}:`;
}

/**
 * Create a standalone client (not cached). Callers own its lifecycle.
 *
 * @param {string} url - redis:// or rediss:// URL
 * @param {Object} [options] - ioredis options
 * @returns {import('ioredis').Redis}
 */
export function createRedisClient(url, options = {}) {
  const instance = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    ...options,
  });
  instance.on('error', err => log(`connection error: ${err.message}`, 'error'));
  return instance;
}

function ensureShutdownHook() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  register('redis', () => quitRedis());
}

/**
 * Shared command client (lazily created, cached for the process).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('ioredis').Redis|null} null when Redis is not configured
 */
export function getRedisClient(env = process.env) {
  if (!isRedisConfigured(env)) return null;
  if (!client) {
    client = createRedisClient(env.XNAPIFY_REDIS_URL.trim(), {
      keyPrefix: getRedisKeyPrefix(env),
      connectionName: `xnapify:${process.pid}`,
    });
    client.once('ready', () => log(`connected (${getRedisKeyPrefix(env)})`));
    ensureShutdownHook();
  }
  return client;
}

/**
 * Dedicated subscriber connection. A Redis connection in subscriber mode
 * cannot issue regular commands, so pub/sub consumers need their own.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('ioredis').Redis|null}
 */
export function getRedisSubscriber(env = process.env) {
  const base = getRedisClient(env);
  if (!base) return null;
  if (!subscriber) {
    subscriber = base.duplicate({ keyPrefix: '' });
    subscriber.on('error', err =>
      log(`subscriber error: ${err.message}`, 'error'),
    );
  }
  return subscriber;
}

/**
 * Close the shared connections (graceful shutdown).
 * @returns {Promise<void>}
 */
export async function quitRedis() {
  const closing = [];
  for (const instance of [subscriber, client]) {
    if (!instance) continue;
    closing.push(
      instance.quit().catch(() => {
        instance.disconnect();
      }),
    );
  }
  client = null;
  subscriber = null;
  await Promise.allSettled(closing);
}

export default {
  isConfigured: isRedisConfigured,
  getClient: getRedisClient,
  getSubscriber: getRedisSubscriber,
  createClient: createRedisClient,
  getKeyPrefix: getRedisKeyPrefix,
  quit: quitRedis,
};
