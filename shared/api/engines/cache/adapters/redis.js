/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redis cache adapter.
 *
 * Same contract as `MemoryCache` but every method returns a promise. Values
 * are JSON-serialised; keys are namespaced under `prefix` on top of the
 * client's own `keyPrefix`, so `clear()` and `keys()` can enumerate only
 * this cache's entries with SCAN.
 */

const DEFAULT_TTL = 5 * 60 * 1000;

class RedisCache {
  /**
   * @param {Object} options
   * @param {import('ioredis').Redis} options.client - Connected client
   * @param {number} [options.ttl] - Default TTL in ms
   * @param {string} [options.prefix='cache:'] - Namespace within the client prefix
   */
  constructor(options = {}) {
    if (!options.client) {
      throw new TypeError('RedisCache requires a `client` option');
    }
    this.client = options.client;
    this.defaultTTL = options.ttl || DEFAULT_TTL;
    this.prefix = options.prefix || 'cache:';
  }

  keyFor(key) {
    return `${this.prefix}${key}`;
  }

  /** Prefix ioredis applies on the wire (needed for SCAN patterns) */
  clientPrefix() {
    return (this.client.options && this.client.options.keyPrefix) || '';
  }

  async get(key) {
    const raw = await this.client.get(this.keyFor(key));
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    const ms = Math.max(1, Math.floor(ttl));
    await this.client.set(this.keyFor(key), JSON.stringify(value), 'PX', ms);
  }

  async delete(key) {
    const removed = await this.client.del(this.keyFor(key));
    return removed > 0;
  }

  async has(key) {
    const found = await this.client.exists(this.keyFor(key));
    return found > 0;
  }

  /**
   * Enumerate this cache's keys (without prefixes).
   * @returns {Promise<string[]>}
   */
  async keys() {
    const wirePrefix = `${this.clientPrefix()}${this.prefix}`;
    const found = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.client.scan(
        cursor,
        'MATCH',
        `${wirePrefix}*`,
        'COUNT',
        200,
      );
      cursor = String(next);
      for (const fullKey of batch) {
        if (fullKey.startsWith(wirePrefix)) {
          found.push(fullKey.slice(wirePrefix.length));
        }
      }
    } while (cursor !== '0');
    return found;
  }

  async clear() {
    const keys = await this.keys();
    if (keys.length === 0) return 0;
    let removed = 0;
    for (let i = 0; i < keys.length; i += 500) {
      removed += await this.client.del(
        ...keys.slice(i, i + 500).map(key => this.keyFor(key)),
      );
    }
    return removed;
  }

  async stats() {
    const keys = await this.keys();
    return {
      type: 'redis',
      totalEntries: keys.length,
      defaultTTL: this.defaultTTL,
      prefix: `${this.clientPrefix()}${this.prefix}`,
    };
  }

  /** Redis expires keys itself; nothing to sweep. */
  cleanup() {
    return 0;
  }
}

export default RedisCache;
