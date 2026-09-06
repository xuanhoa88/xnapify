/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { createJwt } from '@shared/jwt/factory.js';

import { createFactory } from '../../hook/index.js';
import {
  MemoryRevocationStore,
  getRevocationStore,
  setRevocationStore,
} from '../revocation.js';

import { optionalAuth } from './optionalAuth.js';
import { rotateViaSessionHook } from './refreshToken.js';
import { requireAuth } from './requireAuth.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('auth middlewares — session revocation', () => {
  let jwt;
  let store;
  let previousStore;
  let User;

  function makeContainer() {
    return {
      has: name => ['jwt', 'hook', 'models'].includes(name),
      resolve: name => {
        switch (name) {
          case 'jwt':
            return jwt;
          case 'hook':
            return Object.assign(() => ({}), { has: () => false });
          case 'models':
            return { User };
          default:
            return null;
        }
      },
    };
  }

  function makeReq(token) {
    return {
      cookies: { id_token: token },
      headers: {},
      app: { get: key => (key === 'container' ? makeContainer() : null) },
    };
  }

  function makeRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    };
  }

  beforeEach(() => {
    jwt = createJwt({ secret: SECRET });
    previousStore = getRevocationStore();
    store = new MemoryRevocationStore();
    setRevocationStore(store);
    User = { findByPk: jest.fn().mockResolvedValue({ token_version: 0 }) };
  });

  afterEach(() => {
    setRevocationStore(previousStore);
  });

  const accessToken = (claims = {}) =>
    jwt.generateTypedToken('access', {
      id: 42,
      email: 'u@example.com',
      sid: 'fam-1',
      ver: 0,
      ...claims,
    });

  describe('requireAuth', () => {
    it('accepts a live session', async () => {
      const req = makeReq(accessToken());
      const res = makeRes();
      const next = jest.fn();

      await requireAuth()(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user.id).toBe(42);
      expect(req.authenticated).toBe(true);
    });

    it('rejects a revoked session even though the signature is valid', async () => {
      const token = accessToken();
      // Warm the JWT cache to prove revocation is checked on cache hits too
      const req1 = makeReq(token);
      await requireAuth()(req1, makeRes(), jest.fn());

      store.revokeSession('fam-1');

      const req = makeReq(token);
      const res = makeRes();
      const next = jest.fn();
      await requireAuth()(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'SESSION_REVOKED' }),
      );
    });

    it('rejects a token issued before the user token version was bumped', async () => {
      User.findByPk.mockResolvedValue({ token_version: 1 });
      const req = makeReq(accessToken({ ver: 0 }));
      const res = makeRes();
      const next = jest.fn();

      await requireAuth()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SESSION_SUPERSEDED' }),
      );
    });

    it('leaves tokens without session claims to signature checks only', async () => {
      const req = makeReq(
        jwt.generateTypedToken('access', { id: 1, email: 'x@example.com' }),
      );
      const next = jest.fn();
      await requireAuth()(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(User.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('drops the user and clears cookies when the session was revoked', async () => {
      store.revokeSession('fam-1');
      const req = makeReq(accessToken());
      const res = makeRes();
      const next = jest.fn();

      await optionalAuth()(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.authenticated).toBe(false);
      expect(req.user).toBeUndefined();
      expect(req.tokenCleared).toBe(true);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Auth-Status', 'expired');
    });

    it('keeps a live session authenticated', async () => {
      const req = makeReq(accessToken());
      const res = makeRes();
      await optionalAuth()(req, res, jest.fn());
      expect(req.authenticated).toBe(true);
      expect(req.user.sid).toBe('fam-1');
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('checks revocation even when includeUser is false', async () => {
      store.revokeSession('fam-1');
      const req = makeReq(accessToken());
      await optionalAuth({ includeUser: false })(req, makeRes(), jest.fn());
      expect(req.authenticated).toBe(false);
    });
  });

  describe('rotateViaSessionHook', () => {
    const params = () => ({
      refreshToken: 'rt-1',
      req: { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } },
    });

    it('refuses a channel nothing registered a rotate handler on', async () => {
      const hook = createFactory();
      // A channel exists as soon as any code names it, so this is what an
      // unrelated `hook('auth.session')` elsewhere leaves behind.
      hook('auth.session');

      await expect(rotateViaSessionHook(hook, params())).rejects.toMatchObject({
        name: 'SessionRevokedError',
        code: 'SESSION_HANDLER_MISSING',
        status: 401,
      });
    });

    it('refuses a channel carrying only unrelated events', async () => {
      const hook = createFactory();
      hook('auth.session').on('revoke', jest.fn());

      await expect(rotateViaSessionHook(hook, params())).rejects.toMatchObject({
        code: 'SESSION_HANDLER_MISSING',
      });
    });

    it('reports a registered handler that produced no tokens separately', async () => {
      const hook = createFactory();
      hook('auth.session').on('rotate', jest.fn());

      await expect(rotateViaSessionHook(hook, params())).rejects.toMatchObject({
        name: 'SessionRevokedError',
        code: 'SESSION_ROTATION_FAILED',
        status: 401,
      });
    });

    it('returns the tokens the registered handler produced', async () => {
      const hook = createFactory();
      hook('auth.session').on('rotate', ctx => {
        ctx.tokens = { accessToken: 'at-2', refreshToken: 'rt-2' };
      });

      await expect(rotateViaSessionHook(hook, params())).resolves.toEqual({
        accessToken: 'at-2',
        refreshToken: 'rt-2',
      });
    });
  });
});
