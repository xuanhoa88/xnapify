/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
export function createLoggingMiddleware() {
  const format = __DEV__
    ? 'dev' // Colored concise output for development
    : 'combined'; // Apache combined log format for production

  return morgan(format);
}
