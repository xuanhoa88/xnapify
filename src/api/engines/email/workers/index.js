/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Worker Service - Manages email operations
 * Uses the shared worker engine for worker pool management
 *
 * Features:
 * - Dynamic worker discovery via require.context
 * - Hybrid execution: same-process first, fork fallback
 * - Worker pool management with automatic scaling
 * - Comprehensive error handling and recovery
 */

import { createWorkerService } from '../../worker';
import { EmailWorkerError, WORKER_CONFIG } from '../utils';

// Use require.context to dynamically import worker files
const workersContext = require.context('./', false, /\.worker\.js$/);

// Create worker service with email-specific configuration
const workerService = createWorkerService(workersContext, {
  ErrorHandler: EmailWorkerError,
  engineName: '📧 Email',
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
 * @returns {Promise<Object>} Send result
 */
workerService.processSend = async function processSend(emails, options = {}) {
  return await this.sendRequest('send', 'SEND_EMAIL', {
    type: 'SEND_EMAIL',
    emails,
    options,
  });
};

// =============================================================================
// EXPORTS
// =============================================================================

export default workerService;
