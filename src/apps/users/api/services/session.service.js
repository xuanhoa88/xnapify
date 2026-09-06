/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Session Service — revocable sessions on top of JWTs.
 *
 * Refresh tokens are JWTs registered by JTI in `refresh_tokens`, grouped into
 * a rotation *family* (one family = one login session) so that:
 *
 *   - logout, password change, and deactivation can revoke sessions
 *   - rotation replaces the old token and links it to its successor
 *   - presenting a token that was already rotated (replay of a stolen
 *     token) revokes the entire family
 *   - user status (active / locked / deleted) is re-checked on every refresh
 *
 * Access tokens stay stateless but carry two claims that make revocation
 * take effect immediately instead of at the next refresh:
 *
 *   - `sid` — the family id; revoked families are denylisted for one access
 *     lifetime (see `@shared/api/engines/auth/revocation.js`)
 *   - `ver` — the user's `token_version`; bumping the column invalidates
 *     every token issued before the bump
 *
 * Revocation also closes the user's open WebSocket connections when a `ws`
 * server is supplied, because those were authenticated once at connect time.
 */

import crypto from 'crypto';

import { Op } from 'sequelize';

import {
  ADMIN_ROLE,
  DEFAULT_ACTIONS,
  DEFAULT_RESOURCES,
} from '@shared/api/engines/auth/constants.js';
import {
  getRevocationStore,
  SESSION_REVOKED_TTL_MS,
} from '@shared/api/engines/auth/revocation.js';

import { isAdmin } from '../utils/formatter.js';
import { userFullIncludes } from '../utils/includes.js';
import { collectUserRbacData } from '../utils/rbac/collector.js';

/** Claims stripped from a decoded token before re-issuing */
const RESERVED_CLAIMS = new Set([
  'iat',
  'exp',
  'jti',
  'sid',
  'ver',
  'type',
  'aud',
  'iss',
  'nbf',
]);

/**
 * How long after a token was rotated a second presentation of it is treated
 * as a parallel refresh rather than a replay of a stolen token.
 *
 * Auto-rotation fires on any request made while the access token is within
 * `refreshThreshold` of expiry, so a page that issues several XHRs at once
 * routinely presents the same refresh token more than once. Punishing that
 * as reuse would log the user out mid-work.
 */
export const ROTATION_GRACE_MS = 10_000;

function sessionError(message, name, code, status = 401) {
  const error = new Error(message);
  error.name = name;
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Was this token retired by a rotation that is still in flight?
 *
 * True only when it was retired inside the grace window AND the successor it
 * names really exists and is still live. A token retired by logout or by
 * `revokeUserSessions` names no successor, so an explicit revocation is never
 * mistaken for a parallel refresh.
 *
 * @param {Object} record - RefreshToken row
 * @param {Object} RefreshToken - Model
 * @returns {Promise<boolean>}
 */
async function isFreshlyRotated(record, RefreshToken) {
  if (!record.revoked_at || !record.replaced_by) return false;
  if (Date.now() - record.revoked_at.getTime() >= ROTATION_GRACE_MS) {
    return false;
  }
  const successor = await RefreshToken.findByPk(record.replaced_by, {
    attributes: ['id', 'family_id', 'revoked_at'],
  });
  return (
    !!successor &&
    successor.family_id === record.family_id &&
    !successor.revoked_at
  );
}

/**
 * Two refreshes raced and this one lost. Retryable, and deliberately NOT a
 * `RefreshTokenReuseError`: the caller keeps its cookies, and the winning
 * request has already installed the new pair.
 *
 * @returns {Error}
 */
function rotationConflictError() {
  return sessionError(
    'Refresh token is already being rotated',
    'RefreshTokenRotationConflictError',
    'REFRESH_TOKEN_ROTATION_CONFLICT',
    409,
  );
}

function toUserPayload(decoded) {
  const payload = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (!RESERVED_CLAIMS.has(key)) payload[key] = value;
  }
  return payload;
}

async function resolveTokenVersion(models, userId, provided) {
  if (typeof provided === 'number') return provided;
  const user = await models.User.findByPk(userId, {
    attributes: ['token_version'],
  });
  return user ? Number(user.token_version) || 0 : 0;
}

function disconnectSessions(ws, familyIds, reason) {
  if (!ws || typeof ws.disconnectSession !== 'function') return;
  for (const familyId of familyIds) {
    try {
      ws.disconnectSession(familyId, reason);
    } catch (err) {
      console.warn(
        `[Sessions] Failed to close WS for ${familyId}:`,
        err.message,
      );
    }
  }
}

/**
 * Issue a new access + refresh token pair and persist the refresh token.
 *
 * @param {Object} payload - Token payload (id, email, is_admin, ...)
 * @param {Object} deps
 * @param {Object} deps.jwt - JWT instance from the container
 * @param {Object} deps.models - Sequelize models
 * @param {Object} [deps.meta] - { ip_address, user_agent }
 * @param {string} [deps.familyId] - Reuse an existing rotation family
 * @param {number} [deps.tokenVersion] - Known user token version (skips a lookup)
 * @returns {Promise<{ accessToken: string, refreshToken: string, jti: string, familyId: string }>}
 */
export async function issueTokenPair(
  payload,
  { jwt, models, meta = {}, familyId = null, tokenVersion },
) {
  if (!payload || !payload.id) {
    throw sessionError(
      'Cannot issue tokens without a user id',
      'InvalidSessionPayloadError',
      'SESSION_INVALID_PAYLOAD',
      500,
    );
  }

  const claims = toUserPayload(payload);
  const jti = crypto.randomUUID();
  const family = familyId || crypto.randomUUID();
  const ver = await resolveTokenVersion(models, payload.id, tokenVersion);

  const accessToken = jwt.generateTypedToken('access', {
    ...claims,
    sid: family,
    ver,
  });
  const refreshToken = jwt.generateTypedToken('refresh', { ...claims, jti });

  const { exp } = jwt.decodeToken(refreshToken).payload;

  await models.RefreshToken.create({
    id: jti,
    user_id: payload.id,
    family_id: family,
    expires_at: new Date(exp * 1000),
    ip_address: meta.ip_address || null,
    user_agent: meta.user_agent ? String(meta.user_agent).slice(0, 512) : null,
  });

  return { accessToken, refreshToken, jti, familyId: family };
}

/**
 * Build the payload of the successor token.
 *
 * Authorization claims are read back from the database, never copied from
 * the presented token: `RESERVED_CLAIMS` only strips JWT bookkeeping, so
 * carrying the old payload forward would let a demoted admin stay an admin
 * for the whole 30-day refresh chain. Everything else the token carries
 * (`picture`, `impersonator_id`, extension claims) survives untouched.
 *
 * @param {Object} decoded - Verified payload of the presented refresh token
 * @param {Object} user - Freshly loaded User with roles/groups/permissions
 * @returns {Object} Payload for the successor pair
 */
function toRotatedPayload(decoded, user) {
  const rbac = collectUserRbacData(user);
  return {
    ...toUserPayload(decoded),
    id: user.id,
    email: user.email,
    is_admin: isAdmin(rbac, {
      adminRoleName: ADMIN_ROLE,
      defaultResources: DEFAULT_RESOURCES,
      defaultActions: DEFAULT_ACTIONS,
    }),
  };
}

/**
 * Rotate a refresh token: validate, revoke the old one, issue a new pair.
 *
 * The retire step is a single conditional UPDATE (`revoked_at IS NULL`)
 * rather than a read-then-write, so exactly one of N concurrent refreshes
 * can succeed on any dialect — SQLite included, where `SELECT … FOR UPDATE`
 * does not exist. The losers get a retryable conflict instead of forking
 * the session or tripping reuse detection.
 *
 * @param {string} refreshToken - Presented refresh JWT
 * @param {Object} deps - { jwt, models, meta }
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function rotateTokenPair(refreshToken, { jwt, models, meta }) {
  const { RefreshToken, User } = models;

  // 1. Signature, expiry, and type must be valid before touching the DB
  const decoded = jwt.verifyTypedToken(refreshToken, 'refresh');

  if (!decoded.jti) {
    throw sessionError(
      'Refresh token is missing its identifier',
      'InvalidRefreshTokenError',
      'REFRESH_TOKEN_INVALID',
    );
  }

  const record = await RefreshToken.findByPk(decoded.jti);

  // 2. Unknown JTI: token was never issued by this server (or was purged)
  if (!record) {
    throw sessionError(
      'Refresh token is not recognised',
      'InvalidRefreshTokenError',
      'REFRESH_TOKEN_UNKNOWN',
    );
  }

  // 3. Reuse detection: a rotated/revoked token being replayed means the
  //    family is compromised. Kill every descendant — unless it was retired
  //    moments ago, which is a parallel refresh from the same client and
  //    must not cost the user their session.
  if (record.revoked_at) {
    if (await isFreshlyRotated(record, RefreshToken)) {
      throw rotationConflictError();
    }
    await revokeFamily(record.family_id, { models });
    throw sessionError(
      'Refresh token has been revoked',
      'RefreshTokenReuseError',
      'REFRESH_TOKEN_REUSED',
    );
  }

  if (record.expires_at && record.expires_at.getTime() < Date.now()) {
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { id: record.id, revoked_at: null } },
    );
    throw sessionError(
      'Refresh token has expired',
      'TokenExpiredError',
      'REFRESH_TOKEN_EXPIRED',
    );
  }

  // 4. Re-validate the account AND re-read its authorization claims on every
  //    refresh. Role changes never call revokeUserSessions, so this query is
  //    the only thing standing between a demotion and a stale `is_admin`.
  const user = await User.findByPk(record.user_id, {
    attributes: [
      'id',
      'email',
      'is_active',
      'is_locked',
      'locked_until',
      'token_version',
    ],
    include: userFullIncludes(models, {
      includePermissions: true,
      roleAttributes: ['name'],
      groupAttributes: ['name'],
    }),
  });

  const lockedByTime =
    user && user.locked_until && user.locked_until.getTime() > Date.now();

  if (!user || !user.is_active || user.is_locked || lockedByTime) {
    await revokeFamily(record.family_id, { models });
    throw sessionError(
      'Account is no longer eligible for this session',
      'SessionRevokedError',
      'SESSION_REVOKED',
    );
  }

  // 5. Issue the successor first, so a failure here never leaves the caller
  //    without a usable token, then claim the rotation atomically.
  const next = await issueTokenPair(toRotatedPayload(decoded, user), {
    jwt,
    models,
    meta,
    familyId: record.family_id,
    tokenVersion: Number(user.token_version) || 0,
  });

  const [claimed] = await RefreshToken.update(
    { revoked_at: new Date(), replaced_by: next.jti },
    { where: { id: record.id, revoked_at: null } },
  );

  if (claimed === 0) {
    // Another request retired this token between step 3 and here. Drop the
    // successor we just minted rather than leaving the family with two live
    // branches, and report a conflict — the family stays intact.
    await RefreshToken.destroy({ where: { id: next.jti } });
    throw rotationConflictError();
  }

  return { accessToken: next.accessToken, refreshToken: next.refreshToken };
}

/**
 * Revoke every token in a rotation family (one login session).
 *
 * Marks the refresh rows revoked, denylists the family so access tokens
 * die immediately, and closes WebSocket connections opened by it.
 *
 * @param {string} familyId
 * @param {Object} deps - { models, ws? }
 * @returns {Promise<number>} Number of refresh tokens revoked
 */
export async function revokeFamily(familyId, { models, ws = null }) {
  if (!familyId) return 0;
  const [count] = await models.RefreshToken.update(
    { revoked_at: new Date() },
    { where: { family_id: familyId, revoked_at: null } },
  );

  await getRevocationStore().revokeSession(familyId, SESSION_REVOKED_TTL_MS);
  disconnectSessions(ws, [familyId], 'Session revoked');

  return count;
}

/**
 * Revoke the session that a presented refresh token belongs to.
 * Tolerates malformed or unknown tokens (logout must never fail).
 */
export async function revokeByToken(refreshToken, { jwt, models, ws = null }) {
  if (!refreshToken) return 0;
  let jti;
  try {
    const decoded = jwt.decodeToken(refreshToken);
    jti = decoded && decoded.payload && decoded.payload.jti;
  } catch {
    return 0;
  }
  if (!jti) return 0;

  const record = await models.RefreshToken.findByPk(jti);
  if (!record) return 0;
  return revokeFamily(record.family_id, { models, ws });
}

/**
 * Revoke every active session for a user (password change, deactivation,
 * admin action). Optionally keep one family alive (the current session).
 *
 * Without `exceptFamilyId` the user's `token_version` is bumped as well, so
 * the revocation is durable across restarts and covers tokens whose family
 * this process never saw. With `exceptFamilyId` the surviving session must
 * keep its current access token, so only the other families are denylisted.
 *
 * API keys are long-lived bearer tokens for the same user, so a full
 * revocation deactivates them too — otherwise "signed out everywhere" leaves
 * a 365-day credential working. When a session is being kept alive
 * (`exceptFamilyId`, i.e. the user changing their own password) the keys are
 * left alone so integrations do not break; pass `revokeApiKeys` explicitly to
 * override either way.
 *
 * @param {string|number} userId
 * @param {Object} deps - { models, ws?, exceptFamilyId?, revokeApiKeys? }
 * @returns {Promise<number>} Number of refresh tokens revoked
 */
export async function revokeUserSessions(
  userId,
  { models, ws = null, exceptFamilyId = null, revokeApiKeys },
) {
  if (!userId) return 0;
  const where = { user_id: userId, revoked_at: null };
  if (exceptFamilyId) where.family_id = { [Op.ne]: exceptFamilyId };

  const live = await models.RefreshToken.findAll({
    where,
    attributes: ['family_id'],
    group: ['family_id'],
    raw: true,
  });
  const familyIds = [...new Set(live.map(row => row.family_id))];

  const [count] = await models.RefreshToken.update(
    { revoked_at: new Date() },
    { where },
  );

  const store = getRevocationStore();
  // One round trip per family serialised against Redis; a user with a dozen
  // devices paid a dozen latencies before their sockets were even closed.
  await Promise.all(
    familyIds.map(familyId =>
      store.revokeSession(familyId, SESSION_REVOKED_TTL_MS),
    ),
  );
  disconnectSessions(ws, familyIds, 'Session revoked');

  if (!exceptFamilyId) {
    await models.User.increment('token_version', { where: { id: userId } });
    const user = await models.User.findByPk(userId, {
      attributes: ['token_version'],
    });
    if (user) {
      await store.setUserVersion(userId, Number(user.token_version) || 0);
    }
    if (ws && typeof ws.disconnectUser === 'function') {
      ws.disconnectUser(userId, 'Session revoked');
    }
  }

  if (revokeApiKeys ?? !exceptFamilyId) {
    await revokeUserApiKeys(userId, { models });
  }

  return count;
}

/**
 * Deactivate every live API key of a user.
 *
 * API keys authenticate through their own strategy and carry no rotation
 * family, so the denylist cannot reach them; the `is_active` column is what
 * makes them revocable.
 *
 * @param {string|number} userId
 * @param {Object} deps - { models }
 * @returns {Promise<number>} Number of keys deactivated
 */
export async function revokeUserApiKeys(userId, { models }) {
  if (!userId || !models.UserApiKey) return 0;
  const [count] = await models.UserApiKey.update(
    { is_active: false },
    { where: { user_id: userId, is_active: true } },
  );
  return count;
}

/**
 * Delete tokens that expired or were revoked more than `olderThanMs` ago.
 * Intended for a scheduled job; keeps the table from growing unbounded.
 */
export async function purgeExpired(
  { models },
  olderThanMs = 30 * 24 * 60 * 60 * 1000,
) {
  const cutoff = new Date(Date.now() - olderThanMs);
  return models.RefreshToken.destroy({
    where: {
      [Op.or]: [
        { expires_at: { [Op.lt]: new Date() } },
        { revoked_at: { [Op.lt]: cutoff } },
      ],
    },
  });
}
