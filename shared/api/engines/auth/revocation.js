/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Access-token revocation.
 *
 * Access tokens are stateless JWTs, so revoking a session cannot invalidate
 * a token that was already issued. This module closes that gap with two
 * cheap request-time checks that the auth middlewares run after signature
 * verification:
 *
 *   1. **Session denylist** — every access token carries the id of the
 *      session (refresh-token family) that issued it as `sid`. When that
 *      session is revoked its id is recorded here for the lifetime of an
 *      access token, so remaining tokens die immediately.
 *
 *   2. **User token version** — every access token carries the user's
 *      `token_version` as `ver`. "Sign out everywhere", password changes and
 *      deactivation bump the column; any token carrying an older version is
 *      rejected. The column is durable, so this survives restarts.
 *
 * Storage is behind {@link RevocationStore} so a shared backend (Redis) can
 * replace the in-process map when the app runs more than one instance.
 * The cache engine is deliberately not used: it is a no-op in development
 * and a security control must behave identically in every environment.
 */

import { JWT_TOKEN_TYPES } from '@shared/jwt/constants.js';

const DURATION_UNITS = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parse a jsonwebtoken-style duration ('15m', '1h', '7d', 900) into ms.
 *
 * @param {string|number} value
 * @returns {number} Milliseconds
 */
export function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // jsonwebtoken treats bare numbers as seconds
    return value * 1000;
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?\s*$/i.exec(String(value));
  if (!match) {
    throw new TypeError(`Invalid duration: "${value}"`);
  }
  const unit = (match[2] || 's').toLowerCase();
  return Math.round(parseFloat(match[1]) * DURATION_UNITS[unit]);
}

/** How long a revoked session id must be remembered: one access lifetime. */
export const SESSION_REVOKED_TTL_MS = parseDuration(
  JWT_TOKEN_TYPES.access.expiresIn,
);

/** How long a user's token version is memoised before re-reading the DB. */
export const USER_VERSION_MEMO_MS = 60_000;

/**
 * Build the standard "session revoked" error.
 *
 * @param {string} [code='SESSION_REVOKED']
 * @param {string} [message='Session has been revoked']
 * @returns {Error}
 */
export function sessionRevokedError(
  code = 'SESSION_REVOKED',
  message = 'Session has been revoked',
) {
  const error = new Error(message);
  error.name = 'SessionRevokedError';
  error.code = code;
  error.status = 401;
  return error;
}

/**
 * Build the "cannot tell" error.
 *
 * A REVOKED verdict and an UNREACHABLE store are different conditions: the
 * first is an authentication failure (401), the second is a dependency
 * outage (503). Reporting an outage as 401 would log out every user of the
 * fleet the moment Redis hiccups, and clients treat 401 as "your session is
 * gone" — they clear cookies and bounce to the login screen. A 503 is
 * retryable and leaves the session intact.
 *
 * @returns {Error}
 */
export function sessionUnavailableError() {
  const error = new Error('Session state is temporarily unavailable');
  error.name = 'SessionStoreUnavailableError';
  error.code = 'SESSION_STORE_UNAVAILABLE';
  error.status = 503;
  return error;
}

/**
 * In-process revocation store.
 *
 * Every method may return a promise so that a networked implementation can
 * expose the same interface.
 */
export class MemoryRevocationStore {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.sessions = new Map(); // sid -> expiresAt
    this.versions = new Map(); // userId -> { version, expiresAt }
  }

  /**
   * Remember a revoked session id.
   * @param {string} sid
   * @param {number} ttlMs
   */
  revokeSession(sid, ttlMs = SESSION_REVOKED_TTL_MS) {
    if (!sid) return;
    this.sessions.set(String(sid), this.now() + ttlMs);
  }

  /**
   * @param {string} sid
   * @returns {boolean}
   */
  isSessionRevoked(sid) {
    if (!sid) return false;
    const key = String(sid);
    const expiresAt = this.sessions.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= this.now()) {
      this.sessions.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Cache a user's current token version.
   * @param {string|number} userId
   * @param {number} version
   * @param {number} [ttlMs]
   */
  setUserVersion(userId, version, ttlMs = USER_VERSION_MEMO_MS) {
    if (userId === undefined || userId === null) return;
    this.versions.set(String(userId), {
      version,
      expiresAt: this.now() + ttlMs,
    });
  }

  /**
   * @param {string|number} userId
   * @returns {number|undefined} Cached version, or undefined when unknown
   */
  getUserVersion(userId) {
    if (userId === undefined || userId === null) return undefined;
    const key = String(userId);
    const entry = this.versions.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.versions.delete(key);
      return undefined;
    }
    return entry.version;
  }

  /** Drop expired entries (called opportunistically; maps stay small). */
  prune() {
    const now = this.now();
    for (const [sid, expiresAt] of this.sessions) {
      if (expiresAt <= now) this.sessions.delete(sid);
    }
    for (const [userId, entry] of this.versions) {
      if (entry.expiresAt <= now) this.versions.delete(userId);
    }
  }

  clear() {
    this.sessions.clear();
    this.versions.clear();
  }
}

/**
 * Redis-backed revocation store for multi-instance deployments.
 * Uses only GET/SET/EXISTS so any ioredis-compatible client works.
 */
export class RedisRevocationStore {
  /**
   * @param {Object} client - ioredis-compatible client
   * @param {Object} [options]
   * @param {string} [options.prefix='auth:revoked:']
   */
  constructor(client, { prefix = 'auth:revoked:' } = {}) {
    if (!client || typeof client.set !== 'function') {
      throw new TypeError('RedisRevocationStore requires a Redis client');
    }
    this.client = client;
    this.prefix = prefix;
  }

  sessionKey(sid) {
    return `${this.prefix}sid:${sid}`;
  }

  versionKey(userId) {
    return `${this.prefix}ver:${userId}`;
  }

  async revokeSession(sid, ttlMs = SESSION_REVOKED_TTL_MS) {
    if (!sid) return;
    await this.client.set(this.sessionKey(sid), '1', 'PX', Math.max(1, ttlMs));
  }

  async isSessionRevoked(sid) {
    if (!sid) return false;
    return (await this.client.exists(this.sessionKey(sid))) > 0;
  }

  async setUserVersion(userId, version, ttlMs = USER_VERSION_MEMO_MS) {
    if (userId === undefined || userId === null) return;
    await this.client.set(
      this.versionKey(userId),
      String(version),
      'PX',
      Math.max(1, ttlMs),
    );
  }

  async getUserVersion(userId) {
    if (userId === undefined || userId === null) return undefined;
    const raw = await this.client.get(this.versionKey(userId));
    if (raw === null || raw === undefined) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

let currentStore = new MemoryRevocationStore();

/** @returns {MemoryRevocationStore} The active store */
export function getRevocationStore() {
  return currentStore;
}

/**
 * Replace the active store (e.g. with a Redis-backed implementation).
 * The replacement must implement the {@link MemoryRevocationStore} methods.
 *
 * @param {Object} store
 */
export function setRevocationStore(store) {
  const required = [
    'revokeSession',
    'isSessionRevoked',
    'setUserVersion',
    'getUserVersion',
  ];
  for (const method of required) {
    if (!store || typeof store[method] !== 'function') {
      throw new TypeError(`Revocation store must implement ${method}()`);
    }
  }
  currentStore = store;
}

/**
 * Reject a verified access token whose session or user version was revoked.
 *
 * Tokens that carry neither `sid` nor `ver` (API keys, legacy tokens) pass
 * through untouched — their own strategies decide validity.
 *
 * @param {Object} decoded - Verified access-token payload
 * @param {Object} [options]
 * @param {Object} [options.store] - Revocation store (defaults to the active one)
 * @param {Function} [options.loadUserVersion] - async (userId) => number|undefined
 * @returns {Promise<void>}
 * @throws {Error} SessionRevokedError
 */
export async function assertSessionValid(
  decoded,
  { store = getRevocationStore(), loadUserVersion, logger = console } = {},
) {
  if (!decoded || typeof decoded !== 'object') return;

  // Set once the store stops answering. Every store call is a network call
  // under RedisRevocationStore, so a rejection here means "unknown", not
  // "valid" — but it must not be mistaken for "revoked" either.
  let storeFailed = false;

  if (decoded.sid) {
    try {
      if (await store.isSessionRevoked(decoded.sid)) {
        throw sessionRevokedError('SESSION_REVOKED');
      }
    } catch (error) {
      if (error && error.name === 'SessionRevokedError') throw error;
      storeFailed = true;
      logger.error(
        '[Revocation] Session denylist unavailable:',
        (error && error.message) || error,
      );
    }
  }

  const hasVersionClaim = typeof decoded.ver === 'number' && decoded.id != null;

  if (!hasVersionClaim) {
    // The denylist was the only thing that could have answered, and it did
    // not. There is nothing durable to fall back on.
    if (storeFailed) throw sessionUnavailableError();
    return;
  }

  let current;
  if (!storeFailed) {
    try {
      current = await store.getUserVersion(decoded.id);
    } catch (error) {
      storeFailed = true;
      logger.error(
        '[Revocation] Version memo unavailable:',
        (error && error.message) || error,
      );
    }
  }

  if (current === undefined && typeof loadUserVersion === 'function') {
    try {
      current = await loadUserVersion(decoded.id);
      if (typeof current === 'number' && !storeFailed) {
        try {
          await store.setUserVersion(decoded.id, current);
        } catch (error) {
          logger.error(
            '[Revocation] Could not memoise user version:',
            (error && error.message) || error,
          );
        }
      }
    } catch (error) {
      logger.error(
        '[Revocation] Durable token_version lookup failed:',
        (error && error.message) || error,
      );
    }
  }

  if (typeof current === 'number') {
    // The durable column answered — that verdict stands even if the store
    // is down, which is the whole point of keeping `token_version` in the
    // database. Only the short-lived session denylist is lost.
    if (current > decoded.ver) {
      throw sessionRevokedError('SESSION_SUPERSEDED', 'Session was signed out');
    }
    return;
  }

  // Neither source could answer. Fail closed, but as an outage, not as a
  // revocation.
  if (storeFailed) throw sessionUnavailableError();
}

/**
 * Container-aware wrapper used by the auth middlewares: resolves the user's
 * durable token version from the `User` model when it is not memoised.
 *
 * A user that no longer exists yields an infinite version so every token
 * they still hold is rejected.
 *
 * @param {Object} container - DI container
 * @param {Object} decoded - Verified access-token payload
 * @returns {Promise<void>}
 */
export async function verifyActiveSession(container, decoded) {
  const loadUserVersion = async userId => {
    if (!container || typeof container.has !== 'function') return undefined;
    if (!container.has('models')) return undefined;
    const models = container.resolve('models');
    const User = models && models.User;
    if (!User || typeof User.findByPk !== 'function') return undefined;
    const user = await User.findByPk(userId, { attributes: ['token_version'] });
    if (!user) return Number.POSITIVE_INFINITY;
    return Number(user.token_version) || 0;
  };

  return assertSessionValid(decoded, { loadUserVersion });
}
