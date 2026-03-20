/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import isLocalhostIp from 'is-localhost-ip';

/** Rate limiter cache — never evict (losing a limiter resets its counters) */
const cache = new Map();
const DEFAULT_KEY = '__default__';

/**
 * Lazily require express-rate-limit.
 * Wrapped in try/catch because it depends on node:net (unavailable in Jest).
 */
let rateLimitMod;
function getRateLimit() {
  if (rateLimitMod === undefined) {
    try {
      // eslint-disable-next-line global-require
      const mod = require('express-rate-limit');
      rateLimitMod = mod.default || mod;
    } catch {
      rateLimitMod = null;
    }
  }
  return rateLimitMod;
}

// ---------------------------------------------------------------------------
// Default config (reads from env vars, built once on first access)
// ---------------------------------------------------------------------------

let defaultConfig;
function getDefaultConfig() {
  if (defaultConfig !== undefined) return defaultConfig;

  const windowMs =
    parseInt(process.env.RSK_RATE_LIMIT_WINDOW, 10) || 15 * 60_000;
  const max = parseInt(process.env.RSK_RATE_LIMIT_MAX, 10) || 50;

  defaultConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    async skip(req) {
      try {
        if (req.headers && req.headers['x-forwarded-for']) return false;
        return await isLocalhostIp(
          req.ip || (req.socket && req.socket.remoteAddress) || '',
        );
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
export function createRateLimiter(config, key) {
  const fn = getRateLimit();
  if (!fn) return null;

  // Default key: JSON.stringify works for plain objects but drops functions.
  // Callers with functions must supply a stable key.
  const cacheKey = key || JSON.stringify(config);
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, fn(config));
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
export function resolveRateLimiter(routeRateLimit) {
  if (routeRateLimit === false) return null;

  if (process.env.RSK_RATE_LIMIT === 'false') return null;

  const config = getDefaultConfig();
  if (!config) return null;

  if (routeRateLimit && typeof routeRateLimit === 'object') {
    return createRateLimiter({ ...config, ...routeRateLimit });
  }

  return createRateLimiter(config, DEFAULT_KEY);
}
