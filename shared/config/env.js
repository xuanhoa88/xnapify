/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Environment validation.
 *
 * Validates the `XNAPIFY_*` variables the server depends on at boot so that a
 * misconfigured deployment fails immediately with a readable message instead
 * of surfacing as a runtime error hours later. In production every problem is
 * fatal; in development and test they are reported as warnings so local
 * iteration is not blocked.
 */

import { z } from 'zod';

import {
  DIALECT_SCHEMES,
  detectDialect,
  parseDialect,
} from '@shared/api/engines/db/drivers.js';

/**
 * Accepted `XNAPIFY_DB_URL` schemes, derived from the single dialect table in
 * the db engine so validation can never drift from what actually connects.
 */
const DB_SCHEMES = Object.keys(DIALECT_SCHEMES);

const DURATION_RE = /^\d+(ms|s|m|h|d|w|y)?$/i;

const optionalInt = (min, max) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'must be an integer')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();

const optionalBool = z.enum(['true', 'false']).optional();

const optionalDuration = z
  .string()
  .trim()
  .regex(DURATION_RE, 'must be a duration like 15m, 7d, 3600')
  .optional();

/**
 * Build the schema for a given NODE_ENV. Production tightens the secrets.
 */
function buildSchema(nodeEnv) {
  const isProd = nodeEnv === 'production';

  return z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),

    XNAPIFY_PORT: optionalInt(0, 65535),
    XNAPIFY_HOST: z.string().trim().min(1).optional(),
    XNAPIFY_PUBLIC_APP_URL: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal('')),

    XNAPIFY_DB_URL: z
      .string()
      .trim()
      .refine(
        value => parseDialect(value) !== null,
        `must start with one of ${DB_SCHEMES.map(s => `${s}:`).join(', ')} (or be the bare dialect name)`,
      )
      .optional(),
    XNAPIFY_DB_POOL_MAX: optionalInt(1, 500),
    XNAPIFY_DB_POOL_MIN: optionalInt(0, 500),

    XNAPIFY_QUEUE_TYPE: z.string().trim().min(1).optional(),
    XNAPIFY_QUEUE_DATA_DIR: z.string().trim().min(1).optional(),

    XNAPIFY_KEY: isProd
      ? z
          .string()
          .min(32, 'XNAPIFY_KEY must be at least 32 characters in production')
      : z.string().optional(),
    XNAPIFY_PREV_KEY: z.string().optional(),
    XNAPIFY_JWT_EXPIRY: optionalDuration,
    XNAPIFY_JWT_REFRESH_EXPIRY: optionalDuration,
    XNAPIFY_JWT_ALG: z
      .enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'])
      .optional(),
    XNAPIFY_JWT_CACHE_TTL: optionalInt(0, 24 * 60 * 60 * 1000),

    XNAPIFY_RATE_LIMIT: optionalBool,
    XNAPIFY_RATE_LIMIT_MAX: optionalInt(1, 1_000_000),
    XNAPIFY_RATE_LIMIT_WINDOW: optionalInt(1000, 24 * 60 * 60 * 1000),

    XNAPIFY_CORS_ORIGIN: z.string().optional(),
    XNAPIFY_SSR_CACHE: optionalBool,
    XNAPIFY_SSR_CACHE_TTL: optionalInt(0, 24 * 60 * 60 * 1000),
    XNAPIFY_SSR_CACHE_MAX_BYTES: optionalInt(0, 4 * 1024 * 1024 * 1024),
    XNAPIFY_JWT_NEGATIVE_CACHE_TTL: optionalInt(0, 60 * 60 * 1000),
    XNAPIFY_CLUSTER_WORKERS: z
      .string()
      .trim()
      .regex(/^(auto|true|false|\d+)$/i, 'must be an integer or "auto"')
      .optional(),
    // Set by the cluster primary on each fork and read back by
    // shared/utils/runtime.js as the authoritative worker count.
    XNAPIFY_CLUSTER_SIZE: optionalInt(1, 1024),
    XNAPIFY_NODERED_ENABLED: optionalBool,
    XNAPIFY_COMPRESSION: optionalBool,

    // Explicit signal that TLS is terminated in front of this process.
    // `upgrade-insecure-requests` and HSTS are emitted on the strength of
    // this, not of NODE_ENV: the header is honoured on insecure origins, so
    // asserting it on a plain-HTTP deployment breaks every subresource.
    XNAPIFY_TLS_TERMINATED: optionalBool,

    XNAPIFY_MAINTENANCE_MODE: optionalBool,
    // 16 in every environment. A production-only floor let an 8-15 character
    // token work in dev and then throw at production boot, which is the
    // worst moment to discover it.
    XNAPIFY_MAINTENANCE_BYPASS_TOKEN: z.string().min(16).optional(),

    // Comma-separated extension ids allowed to declare the `*` capability.
    // Read by shared/extension/utils/compat.js; without membership here a
    // manifest cannot grant itself the full container.
    XNAPIFY_TRUSTED_EXTENSIONS: z.string().trim().optional(),

    XNAPIFY_HUB_REGISTRY_URL: z.string().trim().url().optional(),

    XNAPIFY_REDIS_URL: z
      .string()
      .trim()
      .regex(/^rediss?:\/\//, 'must be a redis:// or rediss:// URL')
      .optional(),
    XNAPIFY_REDIS_PREFIX: z.string().trim().max(64).optional(),
  });
}

/**
 * Pick only the keys the schema knows about, treating empty strings as unset
 * so `.env.xnapify` placeholders (`XNAPIFY_FOO=`) do not trip validation.
 */
function collect(env, schema) {
  const picked = {};
  for (const key of Object.keys(schema.shape)) {
    const value = env[key];
    if (value !== undefined && value !== '') picked[key] = value;
  }
  return picked;
}

/**
 * Validate `process.env` (or a provided object).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {Object} [options]
 * @param {boolean} [options.throwOnError] - Default: true in production
 * @param {Function} [options.logger] - Defaults to console.warn / console.error
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateEnv(env = process.env, options = {}) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const { throwOnError = isProd, logger = console } = options;

  const schema = buildSchema(nodeEnv);
  const result = schema.safeParse(collect(env, schema));

  const errors = result.success
    ? []
    : result.error.issues.map(issue => {
        const key = issue.path.join('.') || '(root)';
        return `${key}: ${issue.message}`;
      });

  // Cross-field sanity checks that a schema cannot express
  const poolMin = Number(env.XNAPIFY_DB_POOL_MIN || 0);
  const poolMax = Number(env.XNAPIFY_DB_POOL_MAX || 5);
  if (poolMin > poolMax) {
    errors.push('XNAPIFY_DB_POOL_MIN: must not exceed XNAPIFY_DB_POOL_MAX');
  }
  if (isProd && env.XNAPIFY_CORS_ORIGIN === 'true') {
    errors.push(
      'XNAPIFY_CORS_ORIGIN: "true" allows every origin with credentials — not permitted in production',
    );
  }
  // More than one worker without a shared backend leaves caches, rate
  // limits, session revocation and WebSocket channels per process.
  const workers = String(env.XNAPIFY_CLUSTER_WORKERS || '').toLowerCase();
  const clustered =
    workers === 'auto' ||
    workers === 'true' ||
    (Number.isInteger(Number(workers)) && Number(workers) > 1);
  if (clustered && !env.XNAPIFY_REDIS_URL) {
    errors.push(
      'XNAPIFY_REDIS_URL: required when XNAPIFY_CLUSTER_WORKERS > 1 (shared cache, rate limits, session revocation and WebSocket fan-out)',
    );
  }
  if (clustered) {
    // Every worker runs the migration phase at boot. `withSchemaLock` only
    // serialises them on Postgres and MySQL/MariaDB, and only when the pool
    // can spare a connection to hold the lock on — so clustering on any
    // other dialect, or with a pool of one, is an unguarded migration race.
    const dialect = detectDialect(env.XNAPIFY_DB_URL || '');
    if (dialect === 'sqlite') {
      errors.push(
        'XNAPIFY_CLUSTER_WORKERS: clustering requires a dialect with a cross-process schema lock (postgres or mysql); SQLite workers would race on migrations',
      );
    }
    if (poolMax < 2) {
      errors.push(
        'XNAPIFY_DB_POOL_MAX: must be at least 2 when XNAPIFY_CLUSTER_WORKERS > 1 — the schema lock is held on its own pooled connection',
      );
    }
  }

  if (errors.length === 0) return { ok: true, errors };

  const message = `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`;
  if (throwOnError) {
    const err = new Error(message);
    err.name = 'InvalidEnvironmentError';
    err.code = 'E_INVALID_ENV';
    err.errors = errors;
    throw err;
  }

  logger.warn(`⚠️  ${message}`);
  return { ok: false, errors };
}

export default validateEnv;
