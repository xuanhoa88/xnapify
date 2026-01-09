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
import { EmailError, processEmails } from '../utils';

/**
 * Process email send operations
 * @param {Object} data - Send data
 * @returns {Promise<Object>} Send result
 */
async function processSend(data) {
  const { emails, options } = data;
  const emailList = Array.isArray(emails) ? emails : [emails];

  if (emailList.length === 0) {
    throw new EmailError(
      'At least one email is required',
      'INVALID_INPUT',
      400,
    );
  }

  return processEmails(emailList, options);
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
