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
  setRevocationStore,
  verifyActiveSession,
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
        assertSessionValid({ id: 9, sid: 'fam-1' }, { store: brokenStore(), logger }),
      ).rejects.toMatchObject({ status: 503 });
    });

    it('still reports a genuine revocation as revoked', async () => {
      const store = new MemoryRevocationStore();
      store.revokeSession('fam-1');
      await expect(
        assertSessionValid({ id: 9, sid: 'fam-1', ver: 0 }, { store, logger }),
      ).rejects.toMatchObject({ code: 'SESSION_REVOKED', status: 401 });
    });

    it('survives a memo write that fails after a successful read', async () => {
      const store = new MemoryRevocationStore();
      store.setUserVersion = () => Promise.reject(new Error('write failed'));
      const loadUserVersion = jest.fn().mockResolvedValue(2);
      await expect(
        assertSessionValid({ id: 9, ver: 2 }, { store, loadUserVersion, logger }),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
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
