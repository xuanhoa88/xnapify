/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { LRUCache } from 'lru-cache';

/**
 * In-memory LRU cache for verified JWTs.
 * - max 10 000 entries (prevents unbounded growth)
 * - default TTL 60 s (per-entry TTL may be shorter based on JWT exp)
 */
export const jwtCache = new LRUCache({
  max: 10_000,
  ttl: parseInt(process.env.XNAPIFY_SSR_CACHE_TTL, 10) || 60_000,
});

/**
 * Set a cache entry whose TTL respects the JWT's own `exp` claim.
 * The entry expires at whichever comes first: the cache TTL or the JWT expiry.
 *
 * @param {string} token - Raw JWT string (cache key)
 * @param {Object} decoded - Decoded JWT payload (cache value)
 */
export function cacheToken(token, decoded) {
  const options = {};
  if (decoded.exp) {
    // JWT 'exp' is in seconds; LRUCache ttl is in ms
    const jwtTtlMs = decoded.exp * 1000 - Date.now();
    if (jwtTtlMs > 0) {
      options.ttl = Math.min(jwtTtlMs, 60_000);
    } else {
      // Already expired — don't cache
      return;
    }
  }
  jwtCache.set(token, decoded, options);
}
