/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Health & readiness probes.
 *
 *   GET /api/health — liveness: the process is up and the event loop responds.
 *   GET /api/ready  — readiness: dependencies the app needs to serve traffic
 *                     (database, extension manager) are usable.
 *
 * Both are unauthenticated, exempt from rate limiting, exempt from
 * maintenance mode, and never render SSR, so orchestrators can poll them
 * cheaply.
 */

import { isDraining } from '@shared/utils/lifecycle.js';

const startedAt = Date.now();

/**
 * Schema verification result, cached once it succeeds.
 *
 * A schema cannot regress underneath a running process, so the query runs
 * until it passes and never again. Failures are not cached: a pod that starts
 * while another instance is still migrating must be able to become ready.
 */
let schemaVerified = false;

/**
 * Assert the database carries the schema this build expects.
 *
 * `authenticate()` proves only that a connection can be opened. A pod pointed
 * at a database that has not been migrated passes that, is admitted to the
 * load balancer, and then 500s on real traffic. Compare the tables the
 * registered models need against the tables that exist.
 *
 * Reports `unknown` — never `error` — when the answer cannot be determined
 * (no model registry, dialect without `showAllTables`): an inconclusive check
 * must not take a healthy instance out of rotation.
 *
 * @param {object} container - DI container
 * @returns {Promise<{status: string, missing?: string[], message?: string}>}
 */
async function checkSchema(container) {
  if (schemaVerified) return { status: 'ok' };

  let expected;
  try {
    const models = container.resolve('models');
    const names = typeof models.names === 'function' ? models.names() : [];
    expected = names
      .map(name => {
        const model = models.get(name);
        return model && typeof model.tableName === 'string'
          ? model.tableName
          : null;
      })
      .filter(Boolean);
  } catch (err) {
    return { status: 'unknown', message: err.message };
  }

  if (expected.length === 0) return { status: 'unknown', message: 'no models' };

  try {
    const { connection } = container.resolve('db');
    const queryInterface = connection.getQueryInterface();
    if (!queryInterface || typeof queryInterface.showAllTables !== 'function') {
      return { status: 'unknown', message: 'showAllTables unsupported' };
    }

    const tables = await queryInterface.showAllTables();
    if (!Array.isArray(tables)) {
      return { status: 'unknown', message: 'showAllTables unsupported' };
    }

    // Dialects report either plain names or `{ tableName, schema }`, and some
    // qualify them ('public.users') — index both forms.
    const present = new Set();
    for (const table of tables) {
      const name = String(
        (typeof table === 'string' ? table : table && table.tableName) || '',
      )
        .toLowerCase()
        .trim();
      if (!name) continue;
      present.add(name);
      present.add(name.slice(name.lastIndexOf('.') + 1));
    }
    const missing = expected.filter(
      table => !present.has(table.toLowerCase().trim()),
    );

    if (missing.length > 0) {
      return { status: 'error', missing, message: 'pending migrations' };
    }

    schemaVerified = true;
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * @route GET /api/health
 */
export function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
}

/**
 * @route GET /api/ready
 */
export async function ready(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Shutting down: leave the load balancer before the engines are torn down,
  // otherwise a rolling deploy keeps sending traffic to a pod that is already
  // draining. Liveness stays 200 — the process is alive, just not serving.
  if (isDraining()) {
    return res.status(503).json({
      status: 'draining',
      checks: { process: { status: 'draining' } },
      timestamp: new Date().toISOString(),
      requestId: req.id,
    });
  }

  const container = req.app.get('container');
  const checks = {};

  // Database round-trip
  try {
    const started = Date.now();
    await container.resolve('db').connection.authenticate();
    checks.database = { status: 'ok', latencyMs: Date.now() - started };
  } catch (err) {
    checks.database = { status: 'error', message: err.message };
  }

  // Schema readiness — a reachable but unmigrated database is not ready
  checks.schema = await checkSchema(container);

  // Extension manager finished its initial sync. Extensions that failed to
  // load are reported by name so operators see them without reading logs;
  // they degrade the instance but do not take it out of rotation.
  try {
    const extension = container.resolve('extension');
    const metadata = extension.getAllExtensionMetadata();
    const failed = metadata
      .filter(m => m.state === 'failed')
      .map(m => ({
        id: m.id,
        name: (m.manifest && m.manifest.name) || null,
        error: m.error ? m.error.message : 'unknown',
      }));
    checks.extensions = {
      status: failed.length > 0 ? 'degraded' : 'ok',
      loaded: extension.getAllExtensions().length,
      failed,
    };
  } catch (err) {
    checks.extensions = { status: 'error', message: err.message };
  }

  const statuses = Object.values(checks).map(c => c.status);
  const hasError = statuses.includes('error');
  const degraded = !hasError && statuses.includes('degraded');
  let status = 'ready';
  if (hasError) status = 'unavailable';
  else if (degraded) status = 'degraded';

  return res.status(hasError ? 503 : 200).json({
    status,
    checks,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
}
