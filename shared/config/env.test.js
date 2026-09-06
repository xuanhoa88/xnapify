/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

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

  it('accepts every scheme the db engine can actually connect with', () => {
    // Regression: env.js had its own dialect regex, so `postgresql` (bare)
    // validated here and then provisioned SQLite in preboot.
    for (const url of [
      'sqlite:database.sqlite',
      'postgres',
      'postgresql',
      'postgresql://u:p@h:5432/app',
      'mysql://u:p@h/app',
      'mariadb://u:p@h/app',
    ]) {
      const result = validateEnv(
        { NODE_ENV: 'test', XNAPIFY_DB_URL: url },
        { logger: silent, throwOnError: false },
      );
      expect(result).toEqual({ ok: true, errors: [] });
    }
  });

  it('rejects a database URL no dialect can be derived from', () => {
    const result = validateEnv(
      { NODE_ENV: 'test', XNAPIFY_DB_URL: 'mongodb://h/app' },
      { logger: silent, throwOnError: false },
    );
    expect(result.errors).toEqual([expect.stringContaining('XNAPIFY_DB_URL')]);
  });

  it('refuses to cluster on SQLite', () => {
    // Regression: withSchemaLock is a no-op on SQLite, so four workers all
    // ran the migration phase unguarded against the same file.
    const result = validateEnv(
      {
        NODE_ENV: 'test',
        XNAPIFY_CLUSTER_WORKERS: '4',
        XNAPIFY_REDIS_URL: 'redis://localhost:6379',
      },
      { logger: silent, throwOnError: false },
    );
    expect(result.errors).toEqual([
      expect.stringContaining('XNAPIFY_CLUSTER_WORKERS'),
    ]);
  });

  it('refuses to cluster with a pool too small to hold the schema lock', () => {
    const result = validateEnv(
      {
        NODE_ENV: 'test',
        XNAPIFY_CLUSTER_WORKERS: 'auto',
        XNAPIFY_REDIS_URL: 'redis://localhost:6379',
        XNAPIFY_DB_URL: 'postgres://u:p@h/app',
        XNAPIFY_DB_POOL_MAX: '1',
      },
      { logger: silent, throwOnError: false },
    );
    expect(result.errors).toEqual([
      expect.stringContaining('XNAPIFY_DB_POOL_MAX'),
    ]);
  });

  it('allows clustering on a lockable dialect with a usable pool', () => {
    const result = validateEnv(
      {
        NODE_ENV: 'test',
        XNAPIFY_CLUSTER_WORKERS: '4',
        XNAPIFY_REDIS_URL: 'redis://localhost:6379',
        XNAPIFY_DB_URL: 'postgres://u:p@h/app',
        XNAPIFY_DB_POOL_MAX: '5',
      },
      { logger: silent, throwOnError: false },
    );
    expect(result).toEqual({ ok: true, errors: [] });
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

describe('.env.xnapify documents the validated schema', () => {
  // A variable that validateEnv rejects but the template never mentions is a
  // trap: the operator's only reference says nothing, and the first signal is
  // a hard boot failure in production. XNAPIFY_JWT_CACHE_TTL reached main
  // exactly that way after being renamed from XNAPIFY_SSR_CACHE_TTL.
  //
  // The reverse direction is deliberately not asserted: the template also
  // carries runtime- and build-only keys (uploads, mail providers, OAuth
  // credentials, XNAPIFY_PRECOMPRESS_BROTLI_QUALITY) that the boot validator
  // does not police.
  it('mentions every XNAPIFY_ key the zod schema validates', () => {
    const root = path.resolve(__dirname, '../..');
    const schemaSource = fs.readFileSync(
      path.join(root, 'shared/config/env.js'),
      'utf8',
    );
    const template = fs.readFileSync(path.join(root, '.env.xnapify'), 'utf8');

    const declared = new Set(
      [...schemaSource.matchAll(/(XNAPIFY_[A-Z0-9_]+)\s*:/g)].map(m => m[1]),
    );
    const documented = new Set(
      [...template.matchAll(/(XNAPIFY_[A-Z0-9_]+)/g)].map(m => m[1]),
    );

    expect(declared.size).toBeGreaterThan(0);
    expect([...declared].filter(key => !documented.has(key))).toEqual([]);
  });
});
