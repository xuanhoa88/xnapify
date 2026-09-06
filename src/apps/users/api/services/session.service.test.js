/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import {
  MemoryRevocationStore,
  assertSessionValid,
  getRevocationStore,
  setRevocationStore,
  verifyActiveSession,
} from '@shared/api/engines/auth/revocation.js';
import { createJwt } from '@shared/jwt/factory.js';

import * as sessions from './session.service.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('session.service', () => {
  let models;
  let jwt;
  let user;

  let previousStore;

  beforeEach(async () => {
    ({ models } = globalThis.testDb);
    jwt = createJwt({ secret: SECRET });
    previousStore = getRevocationStore();
    setRevocationStore(new MemoryRevocationStore());
    user = await models.User.create({
      email: `session-${Date.now()}@example.com`,
      password: 'password123',
      is_active: true,
    });
  });

  afterEach(() => {
    setRevocationStore(previousStore);
  });

  const payload = () => ({ id: user.id, email: user.email, is_admin: false });
  const deps = () => ({ jwt, models, meta: { ip_address: '10.0.0.1' } });

  it('issues a pair and records the refresh token by jti', async () => {
    const pair = await sessions.issueTokenPair(payload(), deps());

    expect(pair.accessToken).toEqual(expect.any(String));
    expect(pair.refreshToken).toEqual(expect.any(String));

    const decoded = jwt.verifyTypedToken(pair.refreshToken, 'refresh');
    expect(decoded.jti).toBe(pair.jti);

    const row = await models.RefreshToken.findByPk(pair.jti);
    expect(row).not.toBeNull();
    expect(row.user_id).toBe(user.id);
    expect(row.family_id).toBe(pair.familyId);
    expect(row.revoked_at).toBeNull();
    expect(row.ip_address).toBe('10.0.0.1');
  });

  it('rotates: retires the old token, links the successor, keeps the family', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    const next = await sessions.rotateTokenPair(first.refreshToken, deps());

    const old = await models.RefreshToken.findByPk(first.jti);
    expect(old.revoked_at).not.toBeNull();

    const nextJti = jwt.decodeToken(next.refreshToken).payload.jti;
    expect(old.replaced_by).toBe(nextJti);

    const fresh = await models.RefreshToken.findByPk(nextJti);
    expect(fresh.family_id).toBe(first.familyId);
    expect(fresh.revoked_at).toBeNull();

    // Custom claims survive rotation
    const decoded = jwt.verifyTypedToken(next.accessToken, 'access');
    expect(decoded.email).toBe(user.email);
    expect(decoded.is_admin).toBe(false);
  });

  it('detects replay of an already-rotated token and revokes the family', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    const second = await sessions.rotateTokenPair(first.refreshToken, deps());

    // Age the rotation past the grace window so this reads as a replay
    await models.RefreshToken.update(
      { revoked_at: new Date(Date.now() - sessions.ROTATION_GRACE_MS - 1000) },
      { where: { id: first.jti } },
    );

    await expect(
      sessions.rotateTokenPair(first.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'RefreshTokenReuseError', status: 401 });

    // The legitimate successor is now dead too
    await expect(
      sessions.rotateTokenPair(second.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'RefreshTokenReuseError' });
  });

  it('treats a token re-presented right after rotation as a conflict, not reuse', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    const second = await sessions.rotateTokenPair(first.refreshToken, deps());

    // Parallel XHRs routinely present the same refresh token twice; the
    // loser must not cost the user their session.
    await expect(
      sessions.rotateTokenPair(first.refreshToken, deps()),
    ).rejects.toMatchObject({
      name: 'RefreshTokenRotationConflictError',
      code: 'REFRESH_TOKEN_ROTATION_CONFLICT',
      status: 409,
    });

    // The family survived: the successor still rotates
    await expect(
      sessions.rotateTokenPair(second.refreshToken, deps()),
    ).resolves.toBeDefined();
  });

  it('lets only one of several concurrent rotations win', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        sessions.rotateTokenPair(first.refreshToken, deps()),
      ),
    );

    const winners = results.filter(r => r.status === 'fulfilled');
    expect(winners).toHaveLength(1);
    for (const loser of results.filter(r => r.status === 'rejected')) {
      expect(loser.reason.name).toBe('RefreshTokenRotationConflictError');
    }

    // Exactly one live successor — the losers cleaned theirs up
    const live = await models.RefreshToken.findAll({
      where: { family_id: first.familyId, revoked_at: null },
    });
    expect(live).toHaveLength(1);

    // And the family was never revoked
    const winnerToken = winners[0].value.refreshToken;
    await expect(
      sessions.rotateTokenPair(winnerToken, deps()),
    ).resolves.toBeDefined();
  });

  it('re-reads authorization claims from the database on rotation', async () => {
    const adminRole = await models.Role.create({ name: 'admin' });
    await user.addRole(adminRole);

    const first = await sessions.issueTokenPair(
      { id: user.id, email: user.email, is_admin: true },
      deps(),
    );
    expect(jwt.verifyTypedToken(first.accessToken, 'access').is_admin).toBe(
      true,
    );

    // Demotion never calls revokeUserSessions — rotation is what must notice
    await user.setRoles([]);

    const next = await sessions.rotateTokenPair(first.refreshToken, deps());
    const rotated = jwt.verifyTypedToken(next.accessToken, 'access');
    expect(rotated.is_admin).toBe(false);
    expect(rotated.email).toBe(user.email);
  });

  it('keeps non-authorization claims across rotation', async () => {
    const first = await sessions.issueTokenPair(
      {
        id: user.id,
        email: user.email,
        is_admin: false,
        picture: 'avatar.png',
        impersonator_id: 'admin-1',
      },
      deps(),
    );

    const next = await sessions.rotateTokenPair(first.refreshToken, deps());
    const rotated = jwt.verifyTypedToken(next.accessToken, 'access');
    expect(rotated.picture).toBe('avatar.png');
    expect(rotated.impersonator_id).toBe('admin-1');
  });

  it('rejects a well-signed refresh token that was never issued', async () => {
    const forged = jwt.generateTypedToken('refresh', {
      ...payload(),
      jti: '00000000-0000-4000-8000-000000000000',
    });
    await expect(
      sessions.rotateTokenPair(forged, deps()),
    ).rejects.toMatchObject({ name: 'InvalidRefreshTokenError' });
  });

  it('refuses to rotate for a deactivated user and revokes the family', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    await user.update({ is_active: false });

    await expect(
      sessions.rotateTokenPair(first.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'SessionRevokedError' });

    const row = await models.RefreshToken.findByPk(first.jti);
    expect(row.revoked_at).not.toBeNull();
  });

  it('refuses to rotate for a temporarily locked user', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    await user.update({ locked_until: new Date(Date.now() + 60_000) });

    await expect(
      sessions.rotateTokenPair(first.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'SessionRevokedError' });
  });

  it('rejects an access token presented as a refresh token', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    await expect(
      sessions.rotateTokenPair(first.accessToken, deps()),
    ).rejects.toMatchObject({ name: 'InvalidTokenTypeError' });
  });

  it('revokeByToken kills the whole family; malformed input is a no-op', async () => {
    const first = await sessions.issueTokenPair(payload(), deps());
    const second = await sessions.rotateTokenPair(first.refreshToken, deps());

    expect(await sessions.revokeByToken('not-a-jwt', deps())).toBe(0);
    expect(await sessions.revokeByToken(null, deps())).toBe(0);

    const count = await sessions.revokeByToken(second.refreshToken, deps());
    expect(count).toBe(1);

    await expect(
      sessions.rotateTokenPair(second.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'RefreshTokenReuseError' });
  });

  it('revokeUserSessions revokes every family except the one kept', async () => {
    const a = await sessions.issueTokenPair(payload(), deps());
    const b = await sessions.issueTokenPair(payload(), deps());
    const c = await sessions.issueTokenPair(payload(), deps());

    const count = await sessions.revokeUserSessions(user.id, {
      models,
      exceptFamilyId: c.familyId,
    });
    expect(count).toBe(2);

    await expect(
      sessions.rotateTokenPair(a.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'RefreshTokenReuseError' });
    await expect(
      sessions.rotateTokenPair(b.refreshToken, deps()),
    ).rejects.toMatchObject({ name: 'RefreshTokenReuseError' });
    await expect(
      sessions.rotateTokenPair(c.refreshToken, deps()),
    ).resolves.toBeDefined();
  });

  it('stamps access tokens with the session id and user token version', async () => {
    const pair = await sessions.issueTokenPair(payload(), deps());
    const decoded = jwt.verifyTypedToken(pair.accessToken, 'access');
    expect(decoded.sid).toBe(pair.familyId);
    expect(decoded.ver).toBe(0);

    // Rotation keeps the same session id and refreshes the version
    await user.update({ token_version: 3 });
    const next = await sessions.rotateTokenPair(pair.refreshToken, deps());
    const rotated = jwt.verifyTypedToken(next.accessToken, 'access');
    expect(rotated.sid).toBe(pair.familyId);
    expect(rotated.ver).toBe(3);
  });

  it('revokeFamily denylists the session so access tokens die immediately', async () => {
    const pair = await sessions.issueTokenPair(payload(), deps());
    const decoded = jwt.verifyTypedToken(pair.accessToken, 'access');
    await expect(assertSessionValid(decoded)).resolves.toBeUndefined();

    const ws = { disconnectSession: jest.fn(), disconnectUser: jest.fn() };
    await sessions.revokeFamily(pair.familyId, { models, ws });

    await expect(assertSessionValid(decoded)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    expect(ws.disconnectSession).toHaveBeenCalledWith(
      pair.familyId,
      'Session revoked',
    );
  });

  it('revokeUserSessions bumps token_version and closes the user sockets', async () => {
    const a = await sessions.issueTokenPair(payload(), deps());
    const b = await sessions.issueTokenPair(payload(), deps());
    const ws = { disconnectSession: jest.fn(), disconnectUser: jest.fn() };

    await sessions.revokeUserSessions(user.id, { models, ws });

    await user.reload();
    expect(user.token_version).toBe(1);
    expect(ws.disconnectSession).toHaveBeenCalledTimes(2);
    expect(ws.disconnectUser).toHaveBeenCalledWith(user.id, 'Session revoked');

    // Old access tokens are rejected by the durable version check
    const decodedA = jwt.verifyTypedToken(a.accessToken, 'access');
    await expect(
      verifyActiveSession(
        { has: n => n === 'models', resolve: () => models },
        decodedA,
      ),
    ).rejects.toMatchObject({ name: 'SessionRevokedError' });

    // Fresh tokens carry the new version and pass
    const fresh = await sessions.issueTokenPair(payload(), deps());
    const decodedFresh = jwt.verifyTypedToken(fresh.accessToken, 'access');
    expect(decodedFresh.ver).toBe(1);
    await expect(assertSessionValid(decodedFresh)).resolves.toBeUndefined();
    expect(b.familyId).not.toBe(fresh.familyId);
  });

  it('revokeUserSessions with exceptFamilyId keeps the current access token alive', async () => {
    const keep = await sessions.issueTokenPair(payload(), deps());
    const other = await sessions.issueTokenPair(payload(), deps());

    await sessions.revokeUserSessions(user.id, {
      models,
      exceptFamilyId: keep.familyId,
    });

    await user.reload();
    expect(user.token_version).toBe(0);

    const keptDecoded = jwt.verifyTypedToken(keep.accessToken, 'access');
    const otherDecoded = jwt.verifyTypedToken(other.accessToken, 'access');
    await expect(assertSessionValid(keptDecoded)).resolves.toBeUndefined();
    await expect(assertSessionValid(otherDecoded)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });

  it('revokeUserSessions deactivates the user API keys as well', async () => {
    const key = await models.UserApiKey.create({
      user_id: user.id,
      name: 'CI',
      token_prefix: 'eyJhbGciO',
      is_active: true,
    });

    await sessions.revokeUserSessions(user.id, { models });

    await key.reload();
    expect(key.is_active).toBe(false);
  });

  it('revokeUserSessions leaves API keys alone when a session is kept', async () => {
    const keep = await sessions.issueTokenPair(payload(), deps());
    const key = await models.UserApiKey.create({
      user_id: user.id,
      name: 'CI',
      token_prefix: 'eyJhbGciO',
      is_active: true,
    });

    await sessions.revokeUserSessions(user.id, {
      models,
      exceptFamilyId: keep.familyId,
    });

    await key.reload();
    expect(key.is_active).toBe(true);

    // …unless the caller asks for it explicitly
    await sessions.revokeUserSessions(user.id, {
      models,
      exceptFamilyId: keep.familyId,
      revokeApiKeys: true,
    });
    await key.reload();
    expect(key.is_active).toBe(false);
  });

  it('purgeExpired removes expired and long-revoked rows only', async () => {
    const live = await sessions.issueTokenPair(payload(), deps());
    const expired = await sessions.issueTokenPair(payload(), deps());
    const oldRevoked = await sessions.issueTokenPair(payload(), deps());

    await models.RefreshToken.update(
      { expires_at: new Date(Date.now() - 1000) },
      { where: { id: expired.jti } },
    );
    await models.RefreshToken.update(
      { revoked_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
      { where: { id: oldRevoked.jti } },
    );

    const removed = await sessions.purgeExpired({ models });
    expect(removed).toBe(2);
    expect(await models.RefreshToken.findByPk(live.jti)).not.toBeNull();
  });
});
