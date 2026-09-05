/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import morgan from 'morgan';

/**
 * Create logging middleware (Morgan)
 *
 * @returns {Function} Logging middleware
 */
// Expose the per-request id (set in server.js) so every access-log line can be
// correlated with error logs and downstream services.
morgan.token('id', req => req.id || '-');
morgan.token('user', req => (req.user && req.user.id) || '-');

export function createLoggingMiddleware() {
  if (__DEV__) {
    // Colored concise output for development
    return morgan(
      ':id :method :url :status :response-time ms - :res[content-length]',
    );
  }

  // Production: single-line JSON so log shippers can parse fields without regex
  return morgan((tokens, req, res) =>
    JSON.stringify({
      time: new Date().toISOString(),
      level: 'info',
      msg: 'http',
      requestId: tokens.id(req, res),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: Number(tokens.status(req, res)) || 0,
      durationMs: Number(tokens['response-time'](req, res)) || 0,
      length: Number(tokens.res(req, res, 'content-length')) || 0,
      ip: tokens['remote-addr'](req, res),
      userId: tokens.user(req, res),
      userAgent: tokens['user-agent'](req, res),
    }),
  );
}
