/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import {
  MemoryRevocationStore,
  getRevocationStore,
  setRevocationStore,
} from '@shared/api/engines/auth/revocation.js';

import { createNodeRedAuth, createNodeRedSessionGuard } from './auth.js';

const ACCESS_COOKIE = 'id_token';
const REFRESH_COOKIE = 'refresh_token';

describe('node-red auth', () => {
  let previousStore;
  let store;
  let User;
  let RefreshToken;
  let jwt;
  let bindings;
  let app;

  beforeEach(() => {
    previousStore = getRevocationStore();
    store = new MemoryRevocationStore();
    setRevocationStore(store);

    User = { findByPk: jest.fn(), findOne: jest.fn() };
    RefreshToken = { findByPk: jest.fn() };

    jwt = {
      verifyTypedToken: jest.fn(),
      cache: { get: jest.fn(() => null) },
      cacheToken: jest.fn(),
    };

    bindings = {
      jwt,
      auth: { middlewares: { hasPermission: jest.fn(() => true) } },
      models: { User, RefreshToken },
      hook: Object.assign(
        () => ({ invoke: jest.fn() }),
        { has: () => false },
      ),
    };

    app = {
      get: key =>
        key === 'container'
          ? {
              has: name => name in bindings,
              resolve: name => bindings[name] || null,
            }
          : null,
    };
  });

  afterEach(() => {
    setRevocationStore(previousStore);
  });

  describe('XnapifyAuthStrategy', () => {
    const Strategy = createNodeRedAuth({ app }).strategy.strategy;

    function runStrategy(req) {
      const strategy = new Strategy({ app }, (profile, done) =>
        done(null, profile),
      );
      const outcome = {};
      strategy.redirect = url => {
        outcome.redirect = url;
      };
      strategy.fail = status => {
        outcome.fail = status;
      };
      strategy.success = user => {
        outcome.success = user;
      };
      strategy.error = err => {
        outcome.error = err;
      };
      return strategy.authenticate(req).then(() => outcome);
    }

    it('refuses a signed token whose session was revoked', async () => {
      jwt.verifyTypedToken.mockReturnValue({
        id: 'u1',
        email: 'u1@example.com',
        sid: 'fam-1',
        ver: 0,
        permissions: ['nodered:admin'],
      });
      store.revokeSession('fam-1');

      const outcome = await runStrategy({
        cookies: { [ACCESS_COOKIE]: 'token' },
      });

      expect(outcome.redirect).toBe('/admin');
      expect(outcome.success).toBeUndefined();
    });

    it('refuses a token superseded by a token_version bump', async () => {
      jwt.verifyTypedToken.mockReturnValue({
        id: 'u1',
        email: 'u1@example.com',
        sid: 'fam-1',
        ver: 1,
        permissions: ['nodered:admin'],
      });
      User.findByPk.mockResolvedValue({ token_version: 4 });

      const outcome = await runStrategy({
        cookies: { [ACCESS_COOKIE]: 'token' },
      });

      expect(outcome.redirect).toBe('/admin');
    });

    it('admits a live session', async () => {
      jwt.verifyTypedToken.mockReturnValue({
        id: 'u1',
        email: 'u1@example.com',
        sid: 'fam-1',
        ver: 2,
        permissions: ['nodered:admin'],
      });
      User.findByPk.mockResolvedValue({ token_version: 2 });

      const outcome = await runStrategy({
        cookies: { [ACCESS_COOKIE]: 'token' },
      });

      expect(outcome.success).toMatchObject({
        username: 'u1@example.com',
        permissions: '*',
      });
    });
  });

  describe('users() lookup used by the bearer token', () => {
    // Built per test: createNodeRedAuth closes over the app instance
    const users = username => createNodeRedAuth({ app }).users(username);

    it('refuses a deactivated account', async () => {
      User.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        is_active: false,
        is_locked: false,
        locked_until: null,
      });

      expect(await users('u1@example.com')).toBeNull();
    });

    it('refuses an account locked by failed logins', async () => {
      User.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        is_active: true,
        is_locked: false,
        locked_until: new Date(Date.now() + 60_000),
      });

      expect(await users('u1@example.com')).toBeNull();
    });

    it('refuses an account that lost its Node-RED permissions', async () => {
      User.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        is_active: true,
        is_locked: false,
        locked_until: null,
      });
      bindings.auth.middlewares.hasPermission.mockReturnValue(false);

      expect(await users('u1@example.com')).toBeNull();
    });

    it('returns the profile for a live account', async () => {
      User.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        is_active: true,
        is_locked: false,
        locked_until: null,
      });

      expect(await users('u1@example.com')).toEqual({
        username: 'u1@example.com',
        permissions: '*',
      });
    });
  });

  describe('createNodeRedSessionGuard', () => {
    let next;
    let guard;

    beforeEach(() => {
      next = jest.fn();
      guard = createNodeRedSessionGuard(app);
    });

    const request = (cookies = {}) => ({
      cookies,
      headers: { authorization: 'Bearer node-red-token' },
    });

    it('keeps the bearer token while the session is live', async () => {
      jwt.verifyTypedToken.mockReturnValue({ id: 'u1', sid: 'fam-1', ver: 0 });
      User.findByPk.mockResolvedValue({ token_version: 0 });

      const req = request({ [ACCESS_COOKIE]: 'token' });
      await guard(req, {}, next);

      expect(req.headers.authorization).toBe('Bearer node-red-token');
      expect(next).toHaveBeenCalled();
    });

    it('strips the bearer token once the session is revoked', async () => {
      jwt.verifyTypedToken.mockReturnValue({ id: 'u1', sid: 'fam-1', ver: 0 });
      store.revokeSession('fam-1');

      const req = request({ [ACCESS_COOKIE]: 'token' });
      await guard(req, {}, next);

      expect(req.headers.authorization).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('strips the bearer token when the refresh family is revoked', async () => {
      jwt.verifyTypedToken.mockImplementation((_token, type) => {
        if (type === 'access') throw new Error('expired');
        return { jti: 'jti-1' };
      });
      RefreshToken.findByPk.mockResolvedValue({
        id: 'jti-1',
        revoked_at: new Date(),
      });

      const req = request({
        [ACCESS_COOKIE]: 'stale',
        [REFRESH_COOKIE]: 'refresh',
      });
      await guard(req, {}, next);

      expect(req.headers.authorization).toBeUndefined();
    });

    it('keeps the bearer token while a stale access token still has a live family', async () => {
      jwt.verifyTypedToken.mockImplementation((_token, type) => {
        if (type === 'access') throw new Error('expired');
        return { jti: 'jti-1' };
      });
      RefreshToken.findByPk.mockResolvedValue({
        id: 'jti-1',
        revoked_at: null,
      });

      const req = request({
        [ACCESS_COOKIE]: 'stale',
        [REFRESH_COOKIE]: 'refresh',
      });
      await guard(req, {}, next);

      expect(req.headers.authorization).toBe('Bearer node-red-token');
    });

    it('strips the bearer token when no cookie is present at all', async () => {
      const req = request();
      await guard(req, {}, next);

      expect(req.headers.authorization).toBeUndefined();
    });

    it('leaves the editor alone when the store cannot answer', async () => {
      jwt.verifyTypedToken.mockReturnValue({ id: 'u1', sid: 'fam-1' });
      setRevocationStore({
        revokeSession: () => Promise.reject(new Error('down')),
        isSessionRevoked: () => Promise.reject(new Error('down')),
        setUserVersion: () => Promise.reject(new Error('down')),
        getUserVersion: () => Promise.reject(new Error('down')),
      });

      const req = request({ [ACCESS_COOKIE]: 'token' });
      await guard(req, {}, next);

      expect(req.headers.authorization).toBe('Bearer node-red-token');
    });
  });
});
