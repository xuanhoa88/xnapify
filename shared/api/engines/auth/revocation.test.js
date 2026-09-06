/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { MemoryRedisClient } from '../redis/memoryClient.js';

import {
  MemoryRevocationStore,
  RedisRevocationStore,
  assertSessionValid,
  getRevocationStore,
  parseDuration,
  resetSessionLiveMemo,
  setRevocationStore,
  verifyActiveSession,
  SESSION_LIVE_MEMO_MS,
  SESSION_REVOKED_TTL_MS,
} from './revocation.js';

/** A store whose every method rejects, like Redis mid-outage. */
function brokenStore(message = 'ECONNREFUSED') {
  const fail = () => Promise.reject(new Error(message));
  return {
    revokeSession: fail,
    isSessionRevoked: fail,
    setUserVersion: fail,
    getUserVersion: fail,
  };
}

describe('revocation', () => {
  describe('parseDuration', () => {
    it('parses jsonwebtoken style durations', () => {
      expect(parseDuration('15m')).toBe(15 * 60_000);
      expect(parseDuration('1h')).toBe(3_600_000);
      expect(parseDuration('7d')).toBe(7 * 86_400_000);
      expect(parseDuration('30s')).toBe(30_000);
      expect(parseDuration('250ms')).toBe(250);
      expect(parseDuration(90)).toBe(90_000);
      expect(parseDuration('42')).toBe(42_000);
    });

    it('rejects garbage', () => {
      expect(() => parseDuration('soon')).toThrow(TypeError);
      expect(() => parseDuration('')).toThrow(TypeError);
    });

    it('derives the denylist TTL from the access token lifetime', () => {
      expect(SESSION_REVOKED_TTL_MS).toBe(15 * 60_000);
    });
  });

  describe('MemoryRevocationStore', () => {
    let now;
    let store;

    beforeEach(() => {
      now = 1_000_000;
      store = new MemoryRevocationStore({ now: () => now });
    });

    it('remembers revoked sessions until the TTL passes', () => {
      store.revokeSession('fam-1', 1000);
      expect(store.isSessionRevoked('fam-1')).toBe(true);
      expect(store.isSessionRevoked('fam-2')).toBe(false);

      now += 999;
      expect(store.isSessionRevoked('fam-1')).toBe(true);
      now += 1;
      expect(store.isSessionRevoked('fam-1')).toBe(false);
      expect(store.sessions.size).toBe(0);
    });

    it('memoises user versions with their own TTL', () => {
      store.setUserVersion(7, 3, 500);
      expect(store.getUserVersion(7)).toBe(3);
      expect(store.getUserVersion('7')).toBe(3);
      now += 500;
      expect(store.getUserVersion(7)).toBeUndefined();
    });

    it('prunes expired entries and clears everything', () => {
      store.revokeSession('a', 10);
      store.revokeSession('b', 10_000);
      store.setUserVersion(1, 1, 10);
      now += 11;
      store.prune();
      expect(store.sessions.size).toBe(1);
      expect(store.versions.size).toBe(0);
      store.clear();
      expect(store.sessions.size).toBe(0);
    });

    it('ignores empty ids', () => {
      store.revokeSession(null);
      store.setUserVersion(undefined, 1);
      expect(store.sessions.size).toBe(0);
      expect(store.isSessionRevoked(undefined)).toBe(false);
      expect(store.getUserVersion(null)).toBeUndefined();
    });
  });

  describe('assertSessionValid', () => {
    let store;

    beforeEach(() => {
      store = new MemoryRevocationStore();
    });

    it('passes tokens without session claims through untouched', async () => {
      await expect(
        assertSessionValid({ id: 1 }, { store }),
      ).resolves.toBeUndefined();
      await expect(
        assertSessionValid(null, { store }),
      ).resolves.toBeUndefined();
    });

    it('rejects a token whose session was revoked', async () => {
      store.revokeSession('fam-1');
      await expect(
        assertSessionValid({ id: 1, sid: 'fam-1', ver: 0 }, { store }),
      ).rejects.toMatchObject({
        name: 'SessionRevokedError',
        code: 'SESSION_REVOKED',
        status: 401,
      });
      await expect(
        assertSessionValid({ id: 1, sid: 'fam-2', ver: 0 }, { store }),
      ).resolves.toBeUndefined();
    });

    it('rejects a token older than the user token version', async () => {
      store.setUserVersion(1, 2);
      await expect(
        assertSessionValid({ id: 1, sid: 'x', ver: 1 }, { store }),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });
      await expect(
        assertSessionValid({ id: 1, sid: 'x', ver: 2 }, { store }),
      ).resolves.toBeUndefined();
    });

    it('loads and memoises the version when it is unknown', async () => {
      const loadUserVersion = jest.fn().mockResolvedValue(5);
      await expect(
        assertSessionValid({ id: 9, ver: 4 }, { store, loadUserVersion }),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });
      expect(loadUserVersion).toHaveBeenCalledWith(9);

      // Second call served from the memo
      await expect(
        assertSessionValid({ id: 9, ver: 5 }, { store, loadUserVersion }),
      ).resolves.toBeUndefined();
      expect(loadUserVersion).toHaveBeenCalledTimes(1);
    });

    it('accepts tokens when no version can be determined', async () => {
      const loadUserVersion = jest.fn().mockResolvedValue(undefined);
      await expect(
        assertSessionValid({ id: 9, ver: 0 }, { store, loadUserVersion }),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertSessionValid when the store is unavailable', () => {
    let logger;

    beforeEach(() => {
      logger = { error: jest.fn() };
    });

    it('falls back to the durable token_version and logs the outage', async () => {
      const loadUserVersion = jest.fn().mockResolvedValue(4);

      // Stale token: the database still knows it was superseded
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 3 },
          { store: brokenStore(), loadUserVersion, logger },
        ),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });

      // Current token: still accepted, the outage does not log anyone out
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 4 },
          { store: brokenStore(), loadUserVersion, logger },
        ),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalled();
    });

    it('reports 503, not 401, when neither source can answer', async () => {
      const loadUserVersion = jest.fn().mockRejectedValue(new Error('db down'));
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 3 },
          { store: brokenStore(), loadUserVersion, logger },
        ),
      ).rejects.toMatchObject({
        name: 'SessionStoreUnavailableError',
        code: 'SESSION_STORE_UNAVAILABLE',
        status: 503,
      });
    });

    it('refuses a token with no durable claim to fall back on', async () => {
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1' },
          { store: brokenStore(), logger },
        ),
      ).rejects.toMatchObject({ status: 503 });
    });

    it('still reports a genuine revocation as revoked', async () => {
      const store = new MemoryRevocationStore();
      store.revokeSession('fam-1');
      await expect(
        assertSessionValid({ id: 9, sid: 'fam-1', ver: 0 }, { store, logger }),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED', status: 401 });
    });

    it('reports 503 when only the durable lookup is down', async () => {
      // A healthy store with no memo yet is not an answer: if the database
      // then throws, nothing has checked `ver` and the request must not be
      // waved through.
      const store = new MemoryRevocationStore();
      const loadUserVersion = jest.fn().mockRejectedValue(new Error('db down'));
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 3 },
          { store, loadUserVersion, logger },
        ),
      ).rejects.toMatchObject({
        name: 'SessionStoreUnavailableError',
        status: 503,
      });
    });

    it('survives a memo write that fails after a successful read', async () => {
      const store = new MemoryRevocationStore();
      store.setUserVersion = () => Promise.reject(new Error('write failed'));
      const loadUserVersion = jest.fn().mockResolvedValue(2);
      await expect(
        assertSessionValid(
          { id: 9, ver: 2 },
          { store, loadUserVersion, logger },
        ),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('assertSessionValid durable session fallback', () => {
    let logger;
    let store;

    beforeEach(() => {
      logger = { error: jest.fn() };
      store = new MemoryRevocationStore();
      resetSessionLiveMemo();
    });

    it('is symmetric with the user version memo', () => {
      expect(SESSION_LIVE_MEMO_MS).toBe(60_000);
    });

    it('denies a family the database says has no live rows left', async () => {
      const loadSessionRevoked = jest.fn().mockResolvedValue(true);

      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 0 },
          { store, loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({
        name: 'SessionRevokedError',
        code: 'SESSION_REVOKED',
        status: 401,
      });

      // The verdict is pushed into the denylist, so the next request never
      // reaches the database again.
      expect(store.isSessionRevoked('fam-1')).toBe(true);
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 0 },
          { store, loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
      expect(loadSessionRevoked).toHaveBeenCalledTimes(1);
    });

    it('never queries when the denylist is shared across processes', async () => {
      const loadSessionRevoked = jest.fn().mockResolvedValue(true);
      const shared = new RedisRevocationStore(new MemoryRedisClient());

      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 0 },
          { store: shared, loadSessionRevoked, logger },
        ),
      ).resolves.toBeUndefined();
      expect(loadSessionRevoked).not.toHaveBeenCalled();

      // …and the same token is caught the moment the store is process-local
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 0 },
          { store, loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
      expect(loadSessionRevoked).toHaveBeenCalledTimes(1);
    });

    it('memoises a live session instead of querying per request', async () => {
      const loadSessionRevoked = jest.fn().mockResolvedValue(false);
      const decoded = { id: 9, sid: 'fam-live', ver: 0 };

      for (let i = 0; i < 5; i += 1) {
        await expect(
          assertSessionValid(decoded, { store, loadSessionRevoked, logger }),
        ).resolves.toBeUndefined();
      }
      expect(loadSessionRevoked).toHaveBeenCalledTimes(1);

      // The memo is a TTL, not a cache forever: dropping it re-queries.
      resetSessionLiveMemo();
      await expect(
        assertSessionValid(decoded, { store, loadSessionRevoked, logger }),
      ).resolves.toBeUndefined();
      expect(loadSessionRevoked).toHaveBeenCalledTimes(2);
    });

    it('skips the check when the caller has nothing to ask', async () => {
      const loadSessionRevoked = jest.fn().mockResolvedValue(undefined);
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1' },
          { store, loadSessionRevoked, logger },
        ),
      ).resolves.toBeUndefined();
    });

    it('reports a failed lookup as 503, never as 401', async () => {
      const loadSessionRevoked = jest
        .fn()
        .mockRejectedValue(new Error('db down'));

      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 0 },
          { store, loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({
        name: 'SessionStoreUnavailableError',
        code: 'SESSION_STORE_UNAVAILABLE',
        status: 503,
      });

      // A token with no durable claim at all lands on the same outage
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1' },
          { store, loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({ status: 503 });

      expect(logger.error).toHaveBeenCalled();
    });

    it('lets a good token_version answer stand despite a failed lookup', async () => {
      // Losing the session check is a degraded read, not an outage: the
      // durable column still answered, so the request must not become a 503.
      const loadSessionRevoked = jest
        .fn()
        .mockRejectedValue(new Error('db down'));
      const loadUserVersion = jest.fn().mockResolvedValue(2);

      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 2 },
          { store, loadSessionRevoked, loadUserVersion, logger },
        ),
      ).resolves.toBeUndefined();

      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1', ver: 1 },
          { store, loadSessionRevoked, loadUserVersion, logger },
        ),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED', status: 401 });
    });

    it('does not query while the denylist is already unreachable', async () => {
      const loadSessionRevoked = jest.fn().mockResolvedValue(true);
      await expect(
        assertSessionValid(
          { id: 9, sid: 'fam-1' },
          { store: brokenStore(), loadSessionRevoked, logger },
        ),
      ).rejects.toMatchObject({ status: 503 });
      expect(loadSessionRevoked).not.toHaveBeenCalled();
    });
  });

  describe('verifyActiveSession', () => {
    let previous;

    beforeEach(() => {
      previous = getRevocationStore();
      setRevocationStore(new MemoryRevocationStore());
    });

    afterEach(() => {
      setRevocationStore(previous);
    });

    function containerWith(User) {
      return {
        has: name => name === 'models',
        resolve: name => (name === 'models' ? { User } : null),
      };
    }

    it('reads token_version from the User model', async () => {
      const User = {
        findByPk: jest.fn().mockResolvedValue({ token_version: 3 }),
      };
      await expect(
        verifyActiveSession(containerWith(User), { id: 1, ver: 2 }),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });
      expect(User.findByPk).toHaveBeenCalledWith(1, {
        attributes: ['token_version'],
      });
    });

    it('rejects every token of a user that no longer exists', async () => {
      const User = { findByPk: jest.fn().mockResolvedValue(null) };
      await expect(
        verifyActiveSession(containerWith(User), { id: 1, ver: 99 }),
      ).rejects.toMatchObject({ code: 'SESSION_SUPERSEDED' });
    });

    it('tolerates containers without models', async () => {
      const container = { has: () => false, resolve: () => null };
      await expect(
        verifyActiveSession(container, { id: 1, ver: 0 }),
      ).resolves.toBeUndefined();
    });

    it('counts live refresh rows to decide whether a session survived', async () => {
      const User = {
        findByPk: jest.fn().mockResolvedValue({ token_version: 0 }),
      };
      const RefreshToken = { count: jest.fn().mockResolvedValue(0) };
      const container = {
        has: name => name === 'models',
        resolve: () => ({ User, RefreshToken }),
      };

      await expect(
        verifyActiveSession(container, { id: 1, sid: 'fam-1', ver: 0 }),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
      expect(RefreshToken.count).toHaveBeenCalledWith({
        where: { family_id: 'fam-1', revoked_at: null },
      });

      RefreshToken.count.mockResolvedValue(1);
      await expect(
        verifyActiveSession(container, { id: 1, sid: 'fam-2', ver: 0 }),
      ).resolves.toBeUndefined();
    });

    it('skips the session check when RefreshToken is not bound', async () => {
      const User = {
        findByPk: jest.fn().mockResolvedValue({ token_version: 0 }),
      };
      await expect(
        verifyActiveSession(containerWith(User), {
          id: 1,
          sid: 'fam-1',
          ver: 0,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('setRevocationStore', () => {
    it('validates the adapter contract', () => {
      expect(() => setRevocationStore({})).toThrow(TypeError);
      expect(() => setRevocationStore(null)).toThrow(TypeError);
    });
  });

  describe('RedisRevocationStore', () => {
    it('shares revocations between clients of the same backend', async () => {
      const a = new MemoryRedisClient({ keyPrefix: 'app:' });
      const b = a.duplicate();
      const storeA = new RedisRevocationStore(a);
      const storeB = new RedisRevocationStore(b);

      await storeA.revokeSession('fam-1', 60_000);
      expect(await storeB.isSessionRevoked('fam-1')).toBe(true);
      expect(await storeB.isSessionRevoked('fam-2')).toBe(false);

      await storeB.setUserVersion(7, 4);
      expect(await storeA.getUserVersion(7)).toBe(4);
      expect(await storeA.getUserVersion(8)).toBeUndefined();
    });

    it('expires entries with the TTL', async () => {
      const client = new MemoryRedisClient();
      const store = new RedisRevocationStore(client);
      await store.revokeSession('fam-1', 1);
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(await store.isSessionRevoked('fam-1')).toBe(false);
    });

    it('works through assertSessionValid', async () => {
      const store = new RedisRevocationStore(new MemoryRedisClient());
      await store.revokeSession('fam-1');
      await expect(
        assertSessionValid({ id: 1, sid: 'fam-1', ver: 0 }, { store }),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    });

    it('requires a client', () => {
      expect(() => new RedisRevocationStore(null)).toThrow(TypeError);
    });
  });
});
