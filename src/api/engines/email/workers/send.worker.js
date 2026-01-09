/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Send Email Worker - Handles email sending operations
 * Supports both same-process and child process execution
 */

import { createWorker, setupForkMode } from '../../worker';
import { send } from '../send';
import { EmailWorkerError } from '../utils';

/**
 * Process email send operations
 * @param {Object} data - Send data
 * @returns {Promise<Object>} Send result
 */
async function processSend(data) {
  const { type, emails, options } = data;

  switch (type) {
    case 'SEND_EMAIL':
      return await send(emails, options);

    default:
      throw new EmailWorkerError(`Unknown send type: ${type}`);
  }
}

// Create worker function using helper
const workerFunction = createWorker(processSend, 'SEND_EMAIL');

// Export for same-process execution
export default workerFunction;

// =============================================================================
// CHILD PROCESS EXECUTION (Fork Mode)
// =============================================================================

// Setup fork mode execution using helper
setupForkMode(processSend, 'SEND_EMAIL', 'Email');
