/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Lightweight SSE-based HMR middleware for rspack.
 *
 * Replaces webpack-hot-middleware with a minimal, zero-dependency
 * implementation that provides the same API surface:
 *
 * - SSE endpoint at `path` (default `/~/__hmr`)
 * - Broadcasts `building`, `built`, and `heartbeat` events
 * - Exposes `.publish(payload)` for custom messages (BrowserSync, extensions)
 * - Exposes `.close()` for graceful shutdown
 *
 * @param {import('@rspack/core').Compiler} compiler - Rspack client compiler
 * @param {Object} [options]
 * @param {string} [options.path='/~/__hmr'] - SSE endpoint path
 * @param {number} [options.heartbeat=10000] - Heartbeat interval in ms
 * @param {boolean|Function} [options.log=false] - Log function or boolean
 * @returns {Function} Express middleware with `.publish()` and `.close()`
 */
function createHmrMiddleware(compiler, options = {}) {
  const {
    path: hmrPath = '/~/__hmr',
    heartbeat = 10_000,
    log = false,
  } = options;

  const logFn = typeof log === 'function' ? log : log ? console.log : () => {};

  /** @type {Set<import('http').ServerResponse>} */
  const clients = new Set();
  let latestStats = null;
  let closed = false;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Build the SSE payload from compiler stats. */
  function buildPayload(stats) {
    return {
      action: 'built',
      hash: stats.hash,
      time: stats.endTime - stats.startTime,
      errors: stats.hasErrors()
        ? stats.compilation.errors.map(e => e.message)
        : [],
      warnings: stats.hasWarnings()
        ? stats.compilation.warnings.map(w => w.message)
        : [],
    };
  }

  /**
   * Broadcast a message to every connected SSE client.
   * This is also exposed as `middleware.publish()` so BrowserSync
   * and extension HMR can push custom events.
   *
   * @param {Object|string} payload
   */
  function publish(payload) {
    if (closed) return;
    const data =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const res of clients) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (_writeErr) {
        clients.delete(res);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Compiler hooks
  // -------------------------------------------------------------------------

  compiler.hooks.invalid.tap('HmrMiddleware', () => {
    logFn('[HMR] Building...');
    publish({ action: 'building' });
  });

  compiler.hooks.done.tap('HmrMiddleware', stats => {
    latestStats = stats;
    publish(buildPayload(stats));
    logFn(`[HMR] Built ${stats.hash} in ${stats.endTime - stats.startTime}ms`);
  });

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  const heartbeatTimer = setInterval(() => {
    publish({ action: 'heartbeat' });
  }, heartbeat);

  // -------------------------------------------------------------------------
  // Express middleware
  // -------------------------------------------------------------------------

  function middleware(req, res, next) {
    // Match path ignoring query string
    const reqPath = req.path || req.url.split('?')[0];
    if (reqPath !== hmrPath) return next();

    // Establish SSE connection
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('\n');

    clients.add(res);

    // Push current build state so late-joining clients are in sync
    if (latestStats) {
      const data = JSON.stringify(buildPayload(latestStats));
      res.write(`data: ${data}\n\n`);
    }

    req.on('close', () => {
      clients.delete(res);
    });
  }

  // Attach public API
  middleware.publish = publish;
  middleware.close = () => {
    closed = true;
    clearInterval(heartbeatTimer);
    for (const res of clients) {
      try {
        res.end();
      } catch (_) {
        // ignore
      }
    }
    clients.clear();
  };

  return middleware;
}

export default createHmrMiddleware;
