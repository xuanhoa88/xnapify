/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Send Service - Worker-enabled wrapper for email sending
 *
 * Provides send functionality with automatic worker offloading based on:
 * - Batch size (5+ emails)
 * - Large email body (100KB+)
 * - Presence of attachments
 */

import { EMAIL_VALIDATED } from '../utils/constants';
import { EmailError, createOperationResult } from '../utils/errors';
import { processEmails } from '../utils/processing';
import { validateEmails } from '../utils/validation';
import { sendEmail } from '../workers';

/**
 * Thresholds for auto-detection of worker usage
 */
const AUTO_WORKER_THRESHOLDS = Object.freeze({
  batchSize: 5, // Use worker for 5+ emails
  largeBodySize: 100 * 1024, // Use worker for 100KB+ body
});

/**
 * Determine whether to use worker process
 * @param {Array} emails - Array of email objects
 * @param {Object} options - Send options
 * @returns {Object} Decision result with useWorker boolean and reason
 */
function makeSendDecision(emails, options = {}) {
  const thresholds = {
    batchThreshold: options.batchThreshold || AUTO_WORKER_THRESHOLDS.batchSize,
    largeBodyThreshold:
      options.largeBodyThreshold || AUTO_WORKER_THRESHOLDS.largeBodySize,
  };

  let useWorker = false;
  let reason = 'Simple email(s), main process sufficient';

  // Check if this is a batch operation
  if (emails.length >= thresholds.batchThreshold) {
    useWorker = true;
    reason = `Batch send (${emails.length} emails)`;
  }
  // Check for large email content in any email
  else if (
    emails.some(
      email =>
        (email.html && email.html.length >= thresholds.largeBodyThreshold) ||
        (email.text && email.text.length >= thresholds.largeBodyThreshold),
    )
  ) {
    useWorker = true;
    reason = 'Large email body';
  }
  // Check for attachments in any email
  else if (
    emails.some(email => email.attachments && email.attachments.length > 0)
  ) {
    useWorker = true;
    reason = 'Has attachment(s)';
  }

  return { useWorker, reason };
}

/**
 * Send email(s) with optional worker processing
 *
 * Validates emails, decides on worker usage, and processes accordingly.
 *
 * @param {Object} manager - EmailManager instance
 * @param {Object|Array} emails - Single email object or array of emails
 * @param {Object} options - Send options
 * @param {string} [options.provider] - Specific provider to use
 * @param {boolean} [options.useWorker] - Worker control:
 *   - `true`: Force worker processing
 *   - `false`: Force direct processing (bypass worker)
 *   - `undefined`: Auto-decide based on thresholds
 * @param {number} [options.batchThreshold=5] - Number of emails to trigger worker
 * @param {number} [options.largeBodyThreshold=102400] - Body size (bytes) to trigger worker
 * @returns {Promise<Object>} Send result
 *
 * @example
 * // Auto-decide (usually direct for single email)
 * await send(manager, { to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
 *
 * @example
 * // Force worker processing
 * await send(manager, email, { useWorker: true });
 *
 * @example
 * // Force direct processing (bypass worker even for batch)
 * await send(manager, emailList, { useWorker: false });
 *
 * @example
 * // Batch emails (auto-offloads to worker for 5+ emails)
 * await send(manager, [
 *   { to: 'user1@example.com', subject: 'Hi', html: '<p>1</p>' },
 *   { to: 'user2@example.com', subject: 'Hi', html: '<p>2</p>' }
 * ]);
 */
export async function send(manager, emails, options = {}) {
  // Normalize to array for validation and processing
  const emailList = Array.isArray(emails) ? emails : [emails];

  // Validate using Zod schema
  const validationResult = validateEmails(emailList);
  if (!validationResult.success) {
    return createOperationResult(
      false,
      null,
      'Validation failed',
      new EmailError(
        JSON.stringify(validationResult.error.flatten()),
        'VALIDATION_ERROR',
        400,
      ),
    );
  }

  // Determine worker usage
  const decision = makeSendDecision(emailList, options);
  const shouldUseWorker =
    options.useWorker === true ||
    (options.useWorker !== false && decision.useWorker);

  if (shouldUseWorker) {
    const sendOptions = {
      ...options,
      // If no provider specified, use the manager's default
      provider: options.provider || manager.defaultProvider,
      // Mark as validated to avoid double validation in worker
      [EMAIL_VALIDATED]: true,
    };

    let workerResult;
    try {
      workerResult = await sendEmail({
        emails: emailList,
        options: sendOptions,
      });
    } catch (err) {
      const errorMsg = err.message || 'Worker processing failed';
      const errorCode = err.code || 'WORKER_ERROR';
      return createOperationResult(false, null, errorMsg, {
        message: errorMsg,
        code: errorCode,
        statusCode: err.statusCode || 500,
      });
    }

    return createOperationResult(
      true,
      workerResult,
      'Email processed successfully',
    );
  }

  // Get provider from manager
  const providerName = options.provider || manager.defaultProvider;
  const provider = manager.getProvider(providerName);

  if (!provider) {
    const errorMsg = `Provider "${providerName}" not found`;
    const err = new EmailError(errorMsg, 'PROVIDER_NOT_FOUND', 404);
    if (options.throwOnError) throw err;
    return createOperationResult(false, null, errorMsg, err);
  }

  // Process directly with provider
  const result = await processEmails(provider, emailList, options);

  if (!result.success && options.throwOnError) {
    throw new EmailError(
      (result.error && result.error.message) ||
        result.message ||
        'Email sending failed',
      (result.error && result.error.code) || 'SEND_FAILED',
      (result.error && result.error.statusCode) || 500,
    );
  }

  return result;
}
