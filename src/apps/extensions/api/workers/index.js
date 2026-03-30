/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extension Worker Pool - Manages Piscina-backed checksum operations.
 * Offloads CPU-bound hashing to worker threads so the main event loop
 * stays responsive during extension install / toggle flows.
 */

import { createWorkerPool } from '@shared/api/engines/worker';

// Auto-load workers via require.context (*.worker.js)
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

const workerPool = createWorkerPool('Extensions', workersContext, {
  maxWorkers: 2,
  workerTimeout: 120_000, // large extension dirs may take time
});

/**
 * Compute SHA-256 checksum for an extension directory.
 *
 * @param {string} dir - Absolute path to extension directory
 * @param {Object} [options] - Hash options override
 * @returns {Promise<string>} Hex-encoded hash
 */
workerPool.computeChecksum = async function computeChecksum(dir, options = {}) {
  const { result } = await this.sendRequest(
    'checksum',
    'COMPUTE_CHECKSUM',
    { dir, options },
    { throwOnError: true },
  );
  return result;
};

/**
 * Verify an extension directory against an expected checksum.
 *
 * @param {string} dir - Absolute path to extension directory
 * @param {string} expectedChecksum - Trusted checksum from DB
 * @param {Object} [options] - Hash options override
 * @returns {Promise<{ valid: boolean, actual: string }>}
 */
workerPool.verifyChecksum = async function verifyChecksum(
  dir,
  expectedChecksum,
  options = {},
) {
  const { result } = await this.sendRequest(
    'checksum',
    'VERIFY_CHECKSUM',
    { dir, expectedChecksum, options },
    { throwOnError: true },
  );
  return result;
};

export default workerPool;
