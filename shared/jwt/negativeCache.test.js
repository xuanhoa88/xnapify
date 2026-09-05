/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { jwtNegativeCache, jwtCache } from './cache.js';
import { createJwtFromEnv } from './factory.js';

const SECRET = 'negative-cache-test-secret-0123456789abcdef';

describe('JWT negative cache', () => {
  let jwt;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.XNAPIFY_KEY = SECRET;
    delete process.env.XNAPIFY_PREV_KEY;
    jwtNegativeCache.clear();
    jwtCache.clear();
    jwt = createJwtFromEnv();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('second failure for the same token is served from cache', () => {
    const bad = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.bad';

    let first;
    try {
      jwt.verifyTypedToken(bad, 'access');
    } catch (err) {
      first = err;
    }
    expect(first).toBeDefined();
    expect(first.cached).toBeUndefined();

    let second;
    try {
      jwt.verifyTypedToken(bad, 'access');
    } catch (err) {
      second = err;
    }
    expect(second.cached).toBe(true);
    expect(second.name).toBe(first.name);
    expect(second.status).toBe(401);
  });

  test('failure is keyed by expected type', () => {
    const { refreshToken } = jwt.generateTokenPair({ id: 7 });

    expect(() => jwt.verifyTypedToken(refreshToken, 'access')).toThrow();
    // Same token, different expected type: must not hit the negative entry
    expect(jwt.verifyTypedToken(refreshToken, 'refresh').id).toBe(7);
  });

  test('valid tokens verify and are not negatively cached', () => {
    const token = jwt.generateTypedToken('access', { id: 42 });
    expect(jwt.verifyTypedToken(token, 'access').id).toBe(42);
    expect(jwtNegativeCache.size).toBe(0);
  });

  test('forgetToken clears a negative entry', () => {
    const bad = 'a.b.c';
    expect(() => jwt.verifyToken(bad)).toThrow();
    expect(jwtNegativeCache.size).toBe(1);
    jwt.forgetToken(bad);
    expect(jwtNegativeCache.size).toBe(0);
  });

  test('key rotation still verifies tokens signed with the previous key', () => {
    process.env.XNAPIFY_PREV_KEY = 'previous-secret-value-0123456789abcdef';
    const previous = createJwtFromEnv();
    process.env.XNAPIFY_KEY = 'previous-secret-value-0123456789abcdef';
    delete process.env.XNAPIFY_PREV_KEY;
    const signer = createJwtFromEnv();
    const token = signer.generateTypedToken('access', { id: 3 });

    expect(previous.verifyTypedToken(token, 'access').id).toBe(3);
    expect(jwtNegativeCache.size).toBe(0);
  });
});
