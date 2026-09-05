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
 * Both are unauthenticated, exempt from rate limiting, and never render SSR,
 * so orchestrators can poll them cheaply.
 */

const startedAt = Date.now();

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
