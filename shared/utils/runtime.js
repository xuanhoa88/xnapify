/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Process topology helpers.
 *
 * The server can run as a single process (default) or as a cluster of
 * workers (`XNAPIFY_CLUSTER_WORKERS`). A few services must exist exactly once
 * per deployment — cron schedules, the embedded Node-RED runtime — and use
 * these helpers to decide whether this process is the one that runs them.
 */

import os from 'os';

/**
 * Number of worker processes requested by configuration.
 * `auto` maps to the number of available CPUs; anything unparsable is 1.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function getClusterWorkerCount(env = process.env) {
  const raw = String(env.XNAPIFY_CLUSTER_WORKERS || '')
    .trim()
    .toLowerCase();
  if (!raw || raw === '0' || raw === '1' || raw === 'false') return 1;
  if (raw === 'auto' || raw === 'true') {
    const cpus =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    return Math.max(1, cpus);
  }
  const parsed = parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

/**
 * Whether this process is a cluster worker (forked by the primary).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isClusterWorker(env = process.env) {
  return (
    env.XNAPIFY_WORKER_INDEX !== undefined && env.XNAPIFY_WORKER_INDEX !== ''
  );
}

/**
 * Zero-based index of this worker within the cluster; 0 when not clustered.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function getWorkerIndex(env = process.env) {
  const parsed = parseInt(env.XNAPIFY_WORKER_INDEX, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Whether this process should run deployment-wide singleton services
 * (cron schedules, Node-RED). True for a non-clustered server and for
 * worker 0 of a cluster.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isSingletonWorker(env = process.env) {
  return !isClusterWorker(env) || getWorkerIndex(env) === 0;
}
