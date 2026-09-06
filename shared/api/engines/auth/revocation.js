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
 *
 * A store declares whether it is shared through a `shared` boolean. Anything
 * that does not say `true` is treated as process-local, because being wrong
 * that way only costs a query. A process-local denylist never hears about a
 * logout that happened on another replica — and one worker per pod passes the
 * `XNAPIFY_CLUSTER_WORKERS > 1` guard in `shared/config/env.js` that requires
 * Redis — so for those stores the session check falls back to the durable
 * `refresh_tokens` rows the revocation itself wrote. That fallback is
 * memoised (see {@link SESSION_LIVE_MEMO_MS}), because the design only works
 * as long as the hot path is a map lookup.
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
 * How long a session confirmed live by the durable fallback is remembered.
 *
 * Symmetric with {@link USER_VERSION_MEMO_MS}, and the same trade: a logout
 * on another replica is visible after at most this long instead of instantly,
 * which is still far better than the full access lifetime it would otherwise
 * take, and the alternative is one database query on every single request.
 */
export const SESSION_LIVE_MEMO_MS = 60_000;

/**
 * Hard cap on the confirmed-live memo. Keys are session ids, so a fleet
 * churning through logins would otherwise grow the map forever. Evicting an
 * entry costs one query, never a wrong verdict, so a blunt cap is safe.
 */
const SESSION_LIVE_MEMO_MAX = 10_000;

/** sid -> expiresAt for sessions the durable fallback confirmed are live. */
const sessionLiveMemo = new Map();

/**
 * @param {string} sid
 * @returns {boolean} True while a confirmed-live verdict is still fresh
 */
function isSessionMemoisedLive(sid) {
  const expiresAt = sessionLiveMemo.get(sid);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    sessionLiveMemo.delete(sid);
    return false;
  }
  return true;
}

/**
 * Remember that a session is live. Prunes opportunistically the way
 * {@link MemoryRevocationStore#prune} does, then enforces the cap.
 *
 * @param {string} sid
 */
function memoiseSessionLive(sid) {
  if (sessionLiveMemo.size >= SESSION_LIVE_MEMO_MAX) {
    const now = Date.now();
    for (const [key, expiresAt] of sessionLiveMemo) {
      if (expiresAt <= now) sessionLiveMemo.delete(key);
    }
    // Every entry shares one TTL, so insertion order is expiry order and the
    // first keys left are the ones closest to expiring anyway.
    while (sessionLiveMemo.size >= SESSION_LIVE_MEMO_MAX) {
      const oldest = sessionLiveMemo.keys().next();
      if (oldest.done) break;
      sessionLiveMemo.delete(oldest.value);
    }
  }
  // Re-inserting keeps insertion order aligned with expiry order.
  sessionLiveMemo.delete(sid);
  sessionLiveMemo.set(sid, Date.now() + SESSION_LIVE_MEMO_MS);
}

/**
 * Forget every confirmed-live verdict.
 *
 * Called whenever the active store changes — a memo built against a
 * process-local denylist says nothing about the store that replaced it — and
 * by tests that need a clean slate.
 */
export function resetSessionLiveMemo() {
  sessionLiveMemo.clear();
}

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
    // Nothing outside this process writes to these maps, so callers must
    // reach for a durable source before trusting "not revoked".
    this.shared = false;
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
    // Every instance of the fleet reads and writes the same keys, so the
    // denylist is authoritative on its own and must not be second-guessed
    // with a per-request database query.
    this.shared = true;
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
 * A store may also set `shared = true` to declare that its denylist is
 * visible to every process. Leaving it unset is the safe default: the
 * session check then confirms "not revoked" against the database.
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
  // The memo was built from the old store's denylist; it means nothing here.
  resetSessionLiveMemo();
}

/**
 * Second-guess a process-local denylist that said "not revoked".
 *
 * `revokeFamily()` — what logout calls — writes `refresh_tokens.revoked_at`
 * and denylists the sid, but only the row is visible to another replica. So
 * where the denylist is not shared, ask the database instead of trusting a
 * map that was never told. Confirmed-live verdicts are memoised, because one
 * query per request would undo the reason this design is cheap; confirmed
 * revoked ones are pushed into the denylist so the next request is a map
 * lookup again.
 *
 * @param {string} sid
 * @param {Object} deps - { store, loadSessionRevoked, logger }
 * @returns {Promise<boolean|undefined>} `true` revoked, `false` live or the
 *   check does not apply, `undefined` when nothing could answer
 */
async function isSessionRevokedDurably(
  sid,
  { store, loadSessionRevoked, logger },
) {
  if (store.shared === true) return false;
  if (typeof loadSessionRevoked !== 'function') return false;
  if (isSessionMemoisedLive(sid)) return false;

  let revoked;
  try {
    revoked = await loadSessionRevoked(sid);
  } catch (error) {
    logger.error(
      '[Revocation] Durable session lookup failed:',
      (error && error.message) || error,
    );
    return undefined;
  }

  if (revoked === true) {
    try {
      await store.revokeSession(sid);
    } catch (error) {
      logger.error(
        '[Revocation] Could not denylist a durably revoked session:',
        (error && error.message) || error,
      );
    }
    return true;
  }

  // Anything but an explicit boolean means the caller had nothing to ask —
  // no models bound, for instance. Skip the check rather than fail closed.
  if (revoked === false) memoiseSessionLive(sid);
  return false;
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
 * @param {Function} [options.loadSessionRevoked] - async (sid) => boolean|undefined;
 *   durable stand-in for a denylist that is not shared across processes
 * @returns {Promise<void>}
 * @throws {Error} SessionRevokedError
 */
export async function assertSessionValid(
  decoded,
  {
    store = getRevocationStore(),
    loadUserVersion,
    loadSessionRevoked,
    logger = console,
  } = {},
) {
  if (!decoded || typeof decoded !== 'object') return;

  // Set once the store stops answering. Every store call is a network call
  // under RedisRevocationStore, so a rejection here means "unknown", not
  // "valid" — but it must not be mistaken for "revoked" either.
  let storeFailed = false;

  // Same meaning for the durable session fallback, tracked apart so a sick
  // database does not stop us reading a healthy store's version memo. Both
  // fold into the one verdict at the bottom of this function.
  let sessionUnknown = false;

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

    // Only worth asking once the denylist has said "not revoked": a store
    // that could not answer at all is already an outage, not a clean pass.
    if (!storeFailed) {
      const revoked = await isSessionRevokedDurably(decoded.sid, {
        store,
        loadSessionRevoked,
        logger,
      });
      if (revoked === true) throw sessionRevokedError('SESSION_REVOKED');
      if (revoked === undefined) sessionUnknown = true;
    }
  }

  const hasVersionClaim = typeof decoded.ver === 'number' && decoded.id != null;

  if (!hasVersionClaim) {
    // The denylist was the only thing that could have answered, and it did
    // not. There is nothing durable to fall back on.
    if (storeFailed || sessionUnknown) throw sessionUnavailableError();
    return;
  }

  let current;
  let durableFailed = false;
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
      // The database was the fallback; losing it too leaves no verdict.
      durableFailed = true;
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
  // revocation. `durableFailed` matters on its own: a healthy store that
  // simply has no memo yet is not an answer, so a database that throws
  // leaves the version unchecked and must not be waved through.
  if (storeFailed || durableFailed || sessionUnknown) {
    throw sessionUnavailableError();
  }
}

/**
 * Container-aware wrapper used by the auth middlewares: resolves the user's
 * durable token version from the `User` model when it is not memoised, and
 * the session's liveness from `refresh_tokens` when the denylist is local.
 *
 * A user that no longer exists yields an infinite version so every token
 * they still hold is rejected.
 *
 * @param {Object} container - DI container
 * @param {Object} decoded - Verified access-token payload
 * @returns {Promise<void>}
 */
export async function verifyActiveSession(container, decoded) {
  const resolveModels = () => {
    if (!container || typeof container.has !== 'function') return null;
    if (!container.has('models')) return null;
    return container.resolve('models') || null;
  };

  const loadUserVersion = async userId => {
    const models = resolveModels();
    const User = models && models.User;
    if (!User || typeof User.findByPk !== 'function') return undefined;
    const user = await User.findByPk(userId, { attributes: ['token_version'] });
    if (!user) return Number.POSITIVE_INFINITY;
    return Number(user.token_version) || 0;
  };

  const loadSessionRevoked = async sid => {
    const models = resolveModels();
    const RefreshToken = models && models.RefreshToken;
    // Undefined skips the check. Failing closed here would lock out every
    // caller that resolves a container without the users module bound.
    if (!RefreshToken || typeof RefreshToken.count !== 'function') {
      return undefined;
    }
    // Revocation is expressed as "the family has no live rows left" rather
    // than as a flag: `revokeFamily` and `revokeUserSessions` both stamp
    // `revoked_at` on every row of the family, and rotation always creates
    // the successor before retiring its predecessor, so a family that is
    // still in use never drops to zero.
    const live = await RefreshToken.count({
      where: { family_id: sid, revoked_at: null },
    });
    return live === 0;
  };

  return assertSessionValid(decoded, { loadUserVersion, loadSessionRevoked });
}
