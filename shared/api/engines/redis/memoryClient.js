/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * In-memory stand-in for the subset of the ioredis API the app uses.
 *
 * Exists so the Redis-backed adapters (cache, revocation store, WebSocket
 * fan-out, rate-limit store) can be unit-tested without a server. Pub/sub
 * is shared between every instance created from the same `bus`, which lets
 * a test simulate several workers.
 *
 * It is NOT a Redis replacement for production.
 */

import { EventEmitter } from 'events';

function now() {
  return Date.now();
}

/**
 * Convert a Redis glob (`*`, `?`) into a RegExp.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export class MemoryRedisClient extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.keyPrefix=''] - Mirrors ioredis `keyPrefix`
   * @param {Map} [options.store] - Shared key store (multi-client tests)
   * @param {EventEmitter} [options.bus] - Shared pub/sub bus
   */
  constructor({ keyPrefix = '', store, bus } = {}) {
    super();
    this.options = { keyPrefix };
    this.store = store || new Map(); // key -> { value, expiresAt|null }
    this.bus = bus || new EventEmitter();
    this.subscriptions = new Set();
    this.status = 'ready';
    this.bus.setMaxListeners(0);
    this.onBusMessage = (channel, message) => {
      if (this.subscriptions.has(channel))
        this.emit('message', channel, message);
    };
    this.bus.on('publish', this.onBusMessage);
    process.nextTick(() => this.emit('ready'));
  }

  keyFor(key) {
    return `${this.options.keyPrefix}${key}`;
  }

  readEntry(fullKey) {
    const entry = this.store.get(fullKey);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= now()) {
      this.store.delete(fullKey);
      return undefined;
    }
    return entry;
  }

  async get(key) {
    const entry = this.readEntry(this.keyFor(key));
    return entry ? entry.value : null;
  }

  /**
   * SET key value [PX ms | EX s] [NX]
   */
  async set(key, value, ...args) {
    let expiresAt = null;
    let nx = false;
    for (let i = 0; i < args.length; i += 1) {
      const flag = String(args[i]).toUpperCase();
      if (flag === 'PX') expiresAt = now() + Number(args[++i]);
      else if (flag === 'EX') expiresAt = now() + Number(args[++i]) * 1000;
      else if (flag === 'NX') nx = true;
    }
    const fullKey = this.keyFor(key);
    if (nx && this.readEntry(fullKey)) return null;
    this.store.set(fullKey, { value: String(value), expiresAt });
    return 'OK';
  }

  async del(...keys) {
    let removed = 0;
    for (const key of keys.flat()) {
      if (this.store.delete(this.keyFor(key))) removed += 1;
    }
    return removed;
  }

  async exists(...keys) {
    let found = 0;
    for (const key of keys.flat()) {
      if (this.readEntry(this.keyFor(key))) found += 1;
    }
    return found;
  }

  async incr(key) {
    const fullKey = this.keyFor(key);
    const entry = this.readEntry(fullKey);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.store.set(fullKey, {
      value: String(next),
      expiresAt: entry ? entry.expiresAt : null,
    });
    return next;
  }

  async pexpire(key, ms) {
    const entry = this.readEntry(this.keyFor(key));
    if (!entry) return 0;
    entry.expiresAt = now() + Number(ms);
    return 1;
  }

  async pttl(key) {
    const entry = this.readEntry(this.keyFor(key));
    if (!entry) return -2;
    return entry.expiresAt === null ? -1 : Math.max(0, entry.expiresAt - now());
  }

  /**
   * SCAN cursor MATCH pattern COUNT n — single page, no prefixing (like Redis).
   */
  async scan(cursor, ...args) {
    let pattern = '*';
    for (let i = 0; i < args.length; i += 1) {
      if (String(args[i]).toUpperCase() === 'MATCH') pattern = args[++i];
    }
    const regex = globToRegExp(pattern);
    const keys = [];
    for (const fullKey of [...this.store.keys()]) {
      if (this.readEntry(fullKey) && regex.test(fullKey)) keys.push(fullKey);
    }
    return ['0', keys];
  }

  async publish(channel, message) {
    this.bus.emit('publish', channel, message);
    return 1;
  }

  async subscribe(...channels) {
    for (const channel of channels.flat()) this.subscriptions.add(channel);
    return this.subscriptions.size;
  }

  async unsubscribe(...channels) {
    for (const channel of channels.flat()) this.subscriptions.delete(channel);
    return this.subscriptions.size;
  }

  /**
   * Raw command dispatch (subset), mirrors `redis.call()`.
   */
  async call(command, ...args) {
    const method = String(command).toLowerCase();
    if (typeof this[method] !== 'function' || method === 'call') {
      throw new Error(`MemoryRedisClient: unsupported command ${command}`);
    }
    return this[method](...args);
  }

  duplicate(overrides = {}) {
    return new MemoryRedisClient({
      keyPrefix: this.options.keyPrefix,
      ...overrides,
      store: this.store,
      bus: this.bus,
    });
  }

  async quit() {
    this.bus.off('publish', this.onBusMessage);
    this.status = 'end';
    return 'OK';
  }

  disconnect() {
    this.bus.off('publish', this.onBusMessage);
    this.status = 'end';
  }
}

export default MemoryRedisClient;
