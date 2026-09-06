/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import isLocalhostIp from 'is-localhost-ip';

/** Rate limiter cache — never evict (losing a limiter resets its counters) */
const cache = new Map();
const DEFAULT_KEY = '__default__';

/**
 * First `useRateLimit` object seen for a generated (identity-less) cache key.
 * A second, different object landing on the same key means two routes are
 * silently sharing one bucket.
 * @type {Map<string, Object>}
 */
const collisionOwners = new Map();

/**
 * Optional shared-store factory. When set (see bootstrap), every limiter is
 * backed by it so counters are shared across workers/instances instead of
 * living in each process. Receives the limiter cache key so each route
 * config gets its own key namespace.
 * @type {null | ((cacheKey: string) => Object)}
 */
let storeFactory = null;

/**
 * Install (or clear) the shared store factory. Existing limiters are
 * discarded so they are rebuilt with the new store on next use.
 * @param {null | ((cacheKey: string) => Object)} factory
 */
export function configureRateLimitStore(factory) {
  storeFactory = typeof factory === 'function' ? factory : null;
  cache.clear();
  collisionOwners.clear();
}

let rateLimitPromise;
async function getRateLimit() {
  if (rateLimitPromise === undefined) {
    rateLimitPromise = import('express-rate-limit')
      .then(mod => ({
        rateLimit: mod.default || mod,
        MemoryStore: mod.MemoryStore,
      }))
      .catch(() => null);
  }
  return rateLimitPromise;
}

// ---------------------------------------------------------------------------
// Default config (reads from env vars, built once on first access)
// ---------------------------------------------------------------------------

let defaultConfig;
function getDefaultConfig() {
  if (defaultConfig !== undefined) return defaultConfig;

  const windowMs =
    parseInt(process.env.XNAPIFY_RATE_LIMIT_WINDOW, 10) || 15 * 60_000;
  // Global ceiling per IP. Sensitive routes (login, register, reset) declare
  // their own much stricter `useRateLimit` export; this default only guards
  // against runaway clients, not brute force.
  const max = parseInt(process.env.XNAPIFY_RATE_LIMIT_MAX, 10) || 1000;

  defaultConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    async skip(req) {
      try {
        if (req.headers && req.headers['x-forwarded-for']) return false;
        const ip = req.ip || (req.socket && req.socket.remoteAddress);
        if (!ip) return false;
        return await isLocalhostIp(ip);
      } catch (error) {
        console.error(`Rate limiter skip error: ${error.message}`);
        return false;
      }
    },
    handler(req, res, _next, info) {
      res.status(info.statusCode || 429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 60_000) + ' minutes',
        limit: max,
        current: (req.rateLimit && req.rateLimit.used) || 0,
        requestId: req.id,
      });
    },
  };

  return defaultConfig;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wrap a shared-store limiter so a store outage degrades instead of 500ing.
 *
 * Rate limiting sits on the hot path of every request, so a Redis blip would
 * otherwise turn into a full API outage. On a store error we count the
 * request in a per-process memory store instead: the limit still applies
 * (per instance rather than per deployment) and the request is never lost.
 *
 * @param {Object} mod - `{ rateLimit, MemoryStore }` from express-rate-limit
 * @param {Object} config - Limiter config
 * @param {Object} store - Shared store
 * @returns {Function} Express middleware
 */
function withStoreFallback({ rateLimit, MemoryStore }, config, store) {
  const primary = rateLimit({ ...config, store });
  let fallback = null;

  return function rateLimiterWithFallback(req, res, next) {
    const degrade = error => {
      console.error(
        `Shared rate-limit store unavailable, counting in-process: ${error.message}`,
      );
      if (!fallback && typeof MemoryStore === 'function') {
        fallback = rateLimit({ ...config, store: new MemoryStore() });
      }
      if (!fallback) return next();
      try {
        fallback(req, res, fallbackError => {
          if (fallbackError) {
            console.error(`Rate limiter failed open: ${fallbackError.message}`);
          }
          next();
        });
      } catch (fallbackError) {
        console.error(`Rate limiter failed open: ${fallbackError.message}`);
        next();
      }
    };

    try {
      primary(req, res, error => (error ? degrade(error) : next()));
    } catch (error) {
      degrade(error);
    }
  };
}

/**
 * Create (or retrieve cached) rate limiter middleware.
 */
export async function createRateLimiter(config, key) {
  const mod = await getRateLimit();
  if (!mod) return null;

  // Default key: JSON.stringify works for plain objects but drops functions.
  // Callers with functions must supply a stable key.
  const cacheKey = key || JSON.stringify(config);
  if (!cache.has(cacheKey)) {
    const store = storeFactory ? storeFactory(cacheKey) : undefined;
    cache.set(
      cacheKey,
      store
        ? withStoreFallback(mod, config, store)
        : mod.rateLimit({ ...config }),
    );
  }
  return cache.get(cacheKey);
}

function warnOnSharedBucket(cacheKey, routeRateLimit) {
  if (!collisionOwners.has(cacheKey)) {
    collisionOwners.set(cacheKey, routeRateLimit);
    return;
  }
  if (collisionOwners.get(cacheKey) !== routeRateLimit) {
    console.warn(
      `Two routes declare the same useRateLimit (${JSON.stringify(routeRateLimit)}) ` +
        'and now share one bucket — give each a `key` to separate them.',
    );
  }
}

/**
 * Resolve rate limiter for a route based on its `useRateLimit` export.
 *
 *   false                 → skip
 *   { key, max, windowMs} → custom (merged with defaults)
 *   undefined             → app default
 *
 * `key` is the route's rate-limit identity, not a limiter option: it is what
 * gives the route its own counter. Without it, every route declaring the same
 * numbers shares a single bucket (six auth routes did), so any route with a
 * custom limit — above all the sensitive ones — must declare one.
 *
 * @param {false|Object|undefined} routeRateLimit - The route's export
 * @param {string} [routeKey] - Route identity supplied by the caller,
 *   used when the export declares no `key` of its own
 */
export async function resolveRateLimiter(routeRateLimit, routeKey) {
  if (routeRateLimit === false) return null;

  if (process.env.XNAPIFY_RATE_LIMIT === 'false') return null;

  const config = getDefaultConfig();
  if (!config) return null;

  if (routeRateLimit && typeof routeRateLimit === 'object') {
    const { key, ...overrides } = routeRateLimit;
    const merged = { ...config, ...overrides };
    const identity = key || routeKey;
    if (identity) return createRateLimiter(merged, `route:${identity}`);

    const cacheKey = JSON.stringify(merged);
    warnOnSharedBucket(cacheKey, routeRateLimit);
    return createRateLimiter(merged, cacheKey);
  }

  return createRateLimiter(config, DEFAULT_KEY);
}
