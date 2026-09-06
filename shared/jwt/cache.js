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
  ttl: parseInt(process.env.XNAPIFY_JWT_CACHE_TTL, 10) || 60_000,
});

/**
 * Negative cache for tokens that failed verification.
 *
 * A token that fails signature, type or expiry checks fails the same way on
 * every retry, but each retry costs a full HMAC/RSA verification plus the
 * exception path inside jsonwebtoken. Without this cache a client sending a
 * garbage cookie makes every request several times more expensive, which is
 * a cheap denial-of-service lever. Entries are short-lived so a key rotation
 * or clock correction recovers quickly.
 */
export const jwtNegativeCache = new LRUCache({
  max: 10_000,
  ttl: parseInt(process.env.XNAPIFY_JWT_NEGATIVE_CACHE_TTL, 10) || 30_000,
});

/**
 * Build the negative-cache key. The expected token type is part of the key
 * because a refresh token legitimately fails an `access` check while still
 * verifying as `refresh`.
 *
 * @param {string} token
 * @param {string} [expectedType]
 * @returns {string}
 */
function negativeKey(token, expectedType) {
  return `${expectedType || '*'}:${token}`;
}

/**
 * Drop every negative entry recorded for a token, whatever expected type it
 * was stored under.
 *
 * @param {string} token
 */
function clearNegativeEntries(token) {
  if (typeof token !== 'string' || !token) return;
  const suffix = `:${token}`;
  for (const key of jwtNegativeCache.keys()) {
    if (key.endsWith(suffix)) jwtNegativeCache.delete(key);
  }
}

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
  // A token that now verifies must not keep an earlier failure on record.
  // Negative entries are keyed by expected type, so the bare token never
  // matches — every entry ending in `:<token>` has to go.
  clearNegativeEntries(token);
}

/**
 * Remember that a token failed verification.
 *
 * Only the fields needed to rebuild an equivalent error are stored, never
 * the original error object (it may hold references to request state).
 *
 * @param {string} token
 * @param {Error} error
 * @param {string} [expectedType]
 */
export function cacheTokenFailure(token, error, expectedType) {
  if (typeof token !== 'string' || !token) return;
  jwtNegativeCache.set(negativeKey(token, expectedType), {
    name: (error && error.name) || 'JsonWebTokenError',
    message: (error && error.message) || 'Invalid token',
    status: (error && error.status) || 401,
    code: error && error.code,
  });
}

/**
 * Return a fresh Error equivalent to a cached verification failure, or null
 * when the token has no negative entry.
 *
 * @param {string} token
 * @param {string} [expectedType]
 * @returns {Error|null}
 */
export function getCachedTokenFailure(token, expectedType) {
  if (typeof token !== 'string' || !token) return null;
  const entry = jwtNegativeCache.get(negativeKey(token, expectedType));
  if (!entry) return null;

  const err = new Error(entry.message);
  err.name = entry.name;
  err.status = entry.status;
  if (entry.code) err.code = entry.code;
  err.cached = true;
  return err;
}

/**
 * Drop every cached verdict for a token (positive and negative).
 *
 * @param {string} token
 */
export function forgetToken(token) {
  jwtCache.delete(token);
  clearNegativeEntries(token);
}
