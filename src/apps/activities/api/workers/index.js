/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Worker Pool - Manages background activities logging tasks
 */

// Auto-load workers via require.context (*.worker.js)
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

export default function getActivityWorkerPool(container) {
  const { createWorkerPool } = container.resolve('worker');
  const workerPool = createWorkerPool('Activities', workersContext, {
    maxWorkers: 1, // Logging is sequential and low-impact
  });

  /**
   * Log a system activity in the background
   * @param {Object} payload - Activity data
   * @returns {Promise<Object>} Result of the log operation
   */
  if (workerPool.log == null) {
    workerPool.log = async function log(payload) {
      return await this.sendRequest('activities', 'LOG_ACTIVITY', {
        models: container.resolve('models'),
        ...payload,
      });
    };
  }

  return workerPool;
}
