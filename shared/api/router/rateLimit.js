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
}

let rateLimitPromise;
async function getRateLimit() {
  if (rateLimitPromise === undefined) {
    rateLimitPromise = import('express-rate-limit')
      .then(mod => mod.default || mod)
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
 * Create (or retrieve cached) rate limiter middleware.
 */
export async function createRateLimiter(config, key) {
  const fn = await getRateLimit();
  if (!fn) return null;

  // Default key: JSON.stringify works for plain objects but drops functions.
  // Callers with functions must supply a stable key.
  const cacheKey = key || JSON.stringify(config);
  if (!cache.has(cacheKey)) {
    const store = storeFactory ? storeFactory(cacheKey) : undefined;
    cache.set(cacheKey, fn(store ? { ...config, store } : config));
  }
  return cache.get(cacheKey);
}

/**
 * Resolve rate limiter for a route based on its `useRateLimit` export.
 *
 *   false            → skip
 *   { max, windowMs} → custom (merged with defaults)
 *   undefined        → app default
 */
export async function resolveRateLimiter(routeRateLimit) {
  if (routeRateLimit === false) return null;

  if (process.env.XNAPIFY_RATE_LIMIT === 'false') return null;

  const config = getDefaultConfig();
  if (!config) return null;

  if (routeRateLimit && typeof routeRateLimit === 'object') {
    return createRateLimiter({ ...config, ...routeRateLimit });
  }

  return createRateLimiter(config, DEFAULT_KEY);
}
