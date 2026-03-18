/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Worker Pool - Manages email operations
 * Uses the shared worker engine for worker pool management
 *
 * Features:
 * - Build-time worker discovery via webpack require.context
 * - Hybrid execution: same-process first, fork fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import { createWorkerPool } from '../../worker';
import { EmailWorkerError } from '../utils/errors';

// Worker configuration
const WORKER_CONFIG = Object.freeze({
  maxWorkers: parseInt(process.env.RSK_MAIL_WORKERS, 10) || 4,
  workerTimeout: parseInt(process.env.RSK_MAIL_WORKER_TIMEOUT, 10) || 60000,
  maxRequestsPerWorker:
    parseInt(process.env.RSK_MAIL_WORKER_MAX_REQ, 10) || 100,
});

// Auto-load workers via require.context (*.worker.js or *.worker.ts)
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

// Create worker pool with email-specific configuration
const workerPool = createWorkerPool('Email', workersContext, {
  ErrorHandler: EmailWorkerError,
  maxWorkers: WORKER_CONFIG.maxWorkers,
  workerTimeout: WORKER_CONFIG.workerTimeout,
  maxRequestsPerWorker: WORKER_CONFIG.maxRequestsPerWorker,
});

// ==========================================================================
// HIGH-LEVEL EMAIL OPERATIONS
// ==========================================================================

/**
 * Process email send (single or bulk)
 * @param {Array|Object} emails - Email(s) to send
 * @param {Object} options - Send options
 * @param {boolean} options.forceFork - Force fork mode for this request
 * @returns {Promise<Object>} Send result
 */
workerPool.processSend = async function processSend(emails, options = {}) {
  const { forceFork, throwOnError, ...sendOptions } = options;
  return await this.sendRequest(
    'send',
    'SEND_EMAIL',
    {
      type: 'SEND_EMAIL',
      emails,
      options: sendOptions,
    },
    { forceFork, throwOnError },
  );
};

/**
 * Unregister the send worker
 * Removes worker from pool and clears module cache
 * @returns {boolean} True if worker was unregistered
 */
workerPool.unregisterSend = function unregisterSend() {
  return this.unregisterWorker('send');
};

// =============================================================================
// EXPORTS
// =============================================================================

export default workerPool;
