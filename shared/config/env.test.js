/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateEnv } from './env.js';

const silent = { warn: jest.fn(), error: jest.fn() };

describe('validateEnv', () => {
  it('accepts a minimal valid production environment', () => {
    const result = validateEnv(
      {
        NODE_ENV: 'production',
        XNAPIFY_KEY: 'k'.repeat(40),
        XNAPIFY_PORT: '1337',
        XNAPIFY_DB_URL: 'postgres://user:pass@db:5432/app',
      },
      { logger: silent },
    );
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('treats empty placeholders as unset', () => {
    const result = validateEnv(
      { NODE_ENV: 'development', XNAPIFY_PORT: '', XNAPIFY_JWT_ALG: '' },
      { logger: silent },
    );
    expect(result.ok).toBe(true);
  });

  it('throws in production when the JWT key is too short', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', XNAPIFY_KEY: 'short' }),
    ).toThrow(/XNAPIFY_KEY/);
  });

  it('throws in production when CORS is wide open', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        XNAPIFY_KEY: 'k'.repeat(40),
        XNAPIFY_CORS_ORIGIN: 'true',
      }),
    ).toThrow(/XNAPIFY_CORS_ORIGIN/);
  });

  it('only warns outside production', () => {
    const result = validateEnv(
      { NODE_ENV: 'development', XNAPIFY_PORT: 'abc', XNAPIFY_JWT_ALG: 'none' },
      { logger: silent },
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('XNAPIFY_PORT'),
        expect.stringContaining('XNAPIFY_JWT_ALG'),
      ]),
    );
    expect(silent.warn).toHaveBeenCalled();
  });

  it('rejects pool min greater than pool max', () => {
    const result = validateEnv(
      { NODE_ENV: 'test', XNAPIFY_DB_POOL_MIN: '10', XNAPIFY_DB_POOL_MAX: '5' },
      { logger: silent, throwOnError: false },
    );
    expect(result.errors).toEqual([
      expect.stringContaining('XNAPIFY_DB_POOL_MIN'),
    ]);
  });
});
