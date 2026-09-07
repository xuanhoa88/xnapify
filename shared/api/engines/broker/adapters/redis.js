/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redis-backed broker adapter — the shared backend for multi-instance
 * deployments.
 *
 * Owns the connection lifecycle: `XNAPIFY_REDIS_URL` / `XNAPIFY_REDIS_PREFIX`
 * are read here, clients are created lazily (constructing this adapter never
 * opens a socket), and `cleanup()` closes what it opened. Callers of the
 * broker interface (`publish`/`subscribe`) never see any of that — a future
 * adapter for a different broker technology (RabbitMQ, Kafka, NATS, ...)
 * can own its own, unrelated connection story without changing a single
 * consumer. See `shared/api/engines/broker/README.md`.
 *
 * `getClient()` is the escape hatch for the consumers that need real Redis
 * commands rather than pub/sub — the shared cache, rate-limit counters,
 * session revocation store and the cron leader lock all read a KV/atomic-set
 * surface no message broker (Redis included, outside of its own command set)
 * is obligated to provide, so they hold the raw client directly.
 */

import Redis from 'ioredis';

import { getDeploymentPrefix } from '../prefix.js';

function log(message, level = 'info') {
  const prefix = '[Redis]';
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${message}`);
  else console.info(`${prefix} ✅ ${message}`);
}

class RedisBroker {
  /**
   * @param {Object} [options]
   * @param {NodeJS.ProcessEnv} [options.env=process.env]
   * @param {import('ioredis').Redis} [options.client] - Pre-built command
   *   client (dependency injection, mainly for tests). When omitted, one is
   *   lazily created from `env.XNAPIFY_REDIS_URL` on first use and owned
   *   (closed) by this adapter.
   * @param {import('ioredis').Redis} [options.subscriber] - Pre-built
   *   dedicated subscriber connection, paired with `client`.
   */
  constructor({ env = process.env, client, subscriber } = {}) {
    this.env = env;
    this.client = client || null;
    this.subscriber = subscriber || null;
    this.ownsClient = false;
    this.ownsSubscriber = false;

    // Kept as sets rather than bound directly to a connection: the
    // subscriber is replaced when one dies, and callers registered a
    // listener with this adapter, not with whichever socket was current.
    this.reconnectHandlers = new Set();
    this.disconnectHandlers = new Set();

    if (this.subscriber) this.bindSubscriberEvents(this.subscriber);
  }

  /**
   * Forward a subscriber connection's lifecycle to the registered handlers.
   *
   * `ready` fires on connect and on every automatic reconnect (ioredis
   * restores its own subscriptions then, so consumers usually no-op).
   * `end` is terminal — ioredis will not reconnect this socket, so its
   * subscriptions are gone for good. Dropping the reference here is what
   * lets the next `subscribe()` build a fresh connection instead of
   * quietly attaching to a dead one.
   *
   * @param {import('ioredis').Redis} subscriber
   */
  bindSubscriberEvents(subscriber) {
    subscriber.on('ready', () => {
      for (const handler of this.reconnectHandlers) handler();
    });

    subscriber.on('end', () => {
      if (this.ownsSubscriber && this.subscriber === subscriber) {
        this.subscriber = null;
      }
      for (const handler of this.disconnectHandlers) handler();
    });
  }

  /** @param {NodeJS.ProcessEnv} [env] */
  static isConfigured(env = process.env) {
    return (
      typeof env.XNAPIFY_REDIS_URL === 'string' &&
      env.XNAPIFY_REDIS_URL.trim().length > 0
    );
  }

  /** @param {NodeJS.ProcessEnv} [env] */
  static getKeyPrefix(env = process.env) {
    return getDeploymentPrefix(env);
  }

  isConfigured() {
    return Boolean(this.client) || RedisBroker.isConfigured(this.env);
  }

  /**
   * The prefix actually in effect on the command client — the injected
   * client's own `keyPrefix` when one was supplied (tests, advanced
   * composition), otherwise the value derived from `env`.
   *
   * Deliberately reads `this.client` rather than calling `ensureClient()`:
   * asking for a name should never be what opens a socket. The two answers
   * cannot disagree, because a client this adapter creates is handed exactly
   * the env-derived prefix computed below.
   */
  getKeyPrefix() {
    const { client } = this;
    const hasKeyPrefix =
      client && client.options && typeof client.options.keyPrefix === 'string';
    return hasKeyPrefix
      ? client.options.keyPrefix
      : RedisBroker.getKeyPrefix(this.env);
  }

  /** Lazily create (or return the injected) command client. */
  ensureClient() {
    if (this.client) return this.client;
    if (!RedisBroker.isConfigured(this.env)) return null;

    const keyPrefix = RedisBroker.getKeyPrefix(this.env);
    this.client = new Redis(this.env.XNAPIFY_REDIS_URL.trim(), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      keyPrefix,
      connectionName: `xnapify:${process.pid}`,
    });
    this.client.on('error', err =>
      log(`connection error: ${err.message}`, 'error'),
    );
    this.client.once('ready', () => log(`connected (${keyPrefix})`));
    this.ownsClient = true;
    return this.client;
  }

  /** Lazily create (or return the injected) dedicated subscriber. */
  ensureSubscriber() {
    if (this.subscriber) return this.subscriber;
    const client = this.ensureClient();
    if (!client) return null;

    this.subscriber = client.duplicate({ keyPrefix: '' });
    this.subscriber.on('error', err =>
      log(`subscriber error: ${err.message}`, 'error'),
    );
    this.ownsSubscriber = true;
    this.bindSubscriberEvents(this.subscriber);
    return this.subscriber;
  }

  /**
   * Shared command client. `null` when Redis is not configured — callers
   * that need raw commands (cache, rate limiting, revocation, schedule lock)
   * are expected to have already gated on `isConfigured()`.
   * @returns {import('ioredis').Redis|null}
   */
  getClient() {
    return this.ensureClient();
  }

  /**
   * Namespace a logical channel name with this client's `keyPrefix`.
   *
   * ioredis never applies `keyPrefix` to PUBLISH/SUBSCRIBE and Redis pub/sub
   * is not database-scoped either, so the channel name is the only isolation
   * two deployments sharing one Redis instance have.
   *
   * @param {string} name - Logical channel name
   * @returns {string}
   */
  channel(name) {
    return `${this.getKeyPrefix()}${name}`;
  }

  /**
   * @param {string} channel
   * @param {string} payload
   * @returns {Promise<void>}
   */
  async publish(channel, payload) {
    const client = this.ensureClient();
    if (!client) {
      throw new Error(
        'RedisBroker: not configured (XNAPIFY_REDIS_URL is not set)',
      );
    }
    await client.publish(channel, payload);
  }

  /**
   * @param {string} channel
   * @param {(payload: string) => void} onMessage
   * @returns {Promise<() => Promise<void>>} Unsubscribe function
   */
  async subscribe(channel, onMessage) {
    const subscriber = this.ensureSubscriber();
    if (!subscriber) {
      throw new Error(
        'RedisBroker: not configured (XNAPIFY_REDIS_URL is not set)',
      );
    }

    const handler = (incomingChannel, payload) => {
      if (incomingChannel === channel) onMessage(payload);
    };

    subscriber.on('message', handler);
    try {
      await subscriber.subscribe(channel);
    } catch (error) {
      // Never leave a dangling listener on a subscriber that failed to
      // subscribe — it is shared and long-lived, so this would otherwise
      // apply messages for a channel this adapter never actually joined.
      subscriber.off('message', handler);
      throw error;
    }

    return async () => {
      subscriber.off('message', handler);
      try {
        await subscriber.unsubscribe(channel);
      } catch {
        // subscriber already closed
      }
    };
  }

  /**
   * Notify `callback` whenever the subscriber connection (re)connects — the
   * cheapest recovery signal ioredis gives us, used to retry a failed
   * `attachPubSub` sooner than the fixed retry interval would.
   *
   * Registering does not itself open a connection; the handler is bound to
   * whichever subscriber is current, including one created later or one
   * built to replace a connection that died.
   *
   * @param {() => void} callback
   * @returns {() => void} Stop listening
   */
  onReconnect(callback) {
    this.reconnectHandlers.add(callback);
    return () => this.reconnectHandlers.delete(callback);
  }

  /**
   * Notify `callback` when the subscriber connection dies for good.
   *
   * Without this the failure is silent in the worst way: a consumer that
   * subscribed once still believes it is attached, no error is raised on the
   * receive path, and cross-instance messages simply stop arriving. The
   * signal lets that consumer drop its stale subscription and re-attach —
   * `subscribe()` will build a fresh connection, because `end` cleared the
   * dead one.
   *
   * @param {() => void} callback
   * @returns {() => void} Stop listening
   */
  onDisconnect(callback) {
    this.disconnectHandlers.add(callback);
    return () => this.disconnectHandlers.delete(callback);
  }

  /** Close only the connections this adapter itself opened. */
  async cleanup() {
    // Each connection is captured in a local BEFORE the fields are cleared:
    // the `quit()` fallback runs after this method has already nulled them,
    // so reading `this.subscriber` from inside the catch would throw a
    // TypeError that `allSettled` swallows — leaving a socket that failed to
    // quit gracefully never force-disconnected, and the process hanging on
    // an open handle at shutdown.
    const closing = [];
    const owned = [
      this.ownsSubscriber ? this.subscriber : null,
      this.ownsClient ? this.client : null,
    ];
    for (const instance of owned) {
      if (!instance) continue;
      closing.push(
        instance.quit().catch(() => {
          instance.disconnect();
        }),
      );
    }
    if (this.ownsSubscriber) this.subscriber = null;
    if (this.ownsClient) this.client = null;
    await Promise.allSettled(closing);
  }
}

export default RedisBroker;
