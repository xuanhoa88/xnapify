/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Unified Email Action - Single entry point for all email operations
 */

import { EmailError, createResponse, validateEmailData } from './utils';
import { EmailManager } from './manager';
import workerService from './workers';

/**
 * Render template with {{placeholder}} substitution
 * @param {string} content - Template string
 * @param {Object} data - Variables to substitute
 * @returns {string} Rendered content
 */
function renderTemplate(content, data) {
  if (!content || !data) return content;

  let result = content;
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, String(value));
  }
  return result;
}

/**
 * Decision logic for whether to use background worker
 * @param {Array} emails - Array of email objects
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeSendDecision(emails, options = {}) {
  const thresholds = {
    batchThreshold: options.batchThreshold || 5,
    largeBodyThreshold: options.largeBodyThreshold || 100 * 1024, // 100KB
  };

  let shouldUseWorker = false;
  let reason = 'Simple email(s), main process sufficient';

  // Check if this is a batch operation
  if (emails.length >= thresholds.batchThreshold) {
    shouldUseWorker = true;
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
    shouldUseWorker = true;
    reason = 'Large email body';
  }
  // Check for attachments in any email
  else if (
    emails.some(email => email.attachments && email.attachments.length > 0)
  ) {
    shouldUseWorker = true;
    reason = 'Has attachment(s)';
  }

  return { shouldUseWorker, reason };
}

/**
 * Process a single email
 * @param {Object} emailData - Email data
 * @param {EmailManager} manager - Email manager instance
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
async function processSingleEmail(emailData, manager, options) {
  const { templateData, templateId, ...restData } = emailData;

  // Provider template (SendGrid/Mailgun)
  if (templateId) {
    return manager.sendTemplate(templateId, templateData || {}, restData.to, {
      ...options,
      ...restData,
    });
  }

  // Render {{placeholders}} if templateData provided
  if (templateData) {
    if (restData.html) {
      restData.html = renderTemplate(restData.html, templateData);
    }
    if (restData.text) {
      restData.text = renderTemplate(restData.text, templateData);
    }
    if (restData.subject) {
      restData.subject = renderTemplate(restData.subject, templateData);
    }
  }

  // Validate and send
  const validated = validateEmailData(restData);
  return manager.send(validated, options);
}

/**
 * Process emails directly (without worker)
 * @param {Array} emailList - Array of emails
 * @param {EmailManager} manager - Email manager
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
async function processEmailsDirect(emailList, manager, options) {
  // Single email
  if (emailList.length === 1) {
    const result = await processSingleEmail(emailList[0], manager, options);
    return createResponse(
      true,
      {
        messageId: result.messageId,
        to: emailList[0].to,
        provider: result.provider,
        sentAt: new Date().toISOString(),
      },
      'Email sent successfully',
    );
  }

  // Bulk emails
  const results = {
    successful: [],
    failed: [],
  };

  for (const emailData of emailList) {
    try {
      const result = await processSingleEmail(emailData, manager, options);
      results.successful.push({
        to: emailData.to,
        messageId: result.messageId,
      });
    } catch (error) {
      results.failed.push({
        to: emailData.to,
        error: error.message,
      });
    }
  }

  return createResponse(
    true,
    {
      successful: results.successful,
      failed: results.failed,
      totalEmails: emailList.length,
      successCount: results.successful.length,
      failCount: results.failed.length,
      provider: options.provider || 'default',
    },
    `Sent ${results.successful.length} of ${emailList.length} emails`,
  );
}

/**
 * Unified email send action
 * Handles single email, bulk emails, and templates
 * Automatically offloads to worker for large/batch operations
 *
 * @param {Array|Object} emails - Single email object or array of emails
 * @param {Object} options - Send options
 * @param {string} [options.provider] - Specific provider to use
 * @param {boolean} [options.useWorker] - Force worker usage (optional)
 * @param {boolean} [options.skipWorker] - Skip worker decision (for worker calls)
 * @returns {Promise<Object>} Send result
 *
 * @example
 * // Single email
 * await send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
 *
 * // With template placeholders
 * await send({
 *   to: 'user@example.com',
 *   subject: 'Hi {{name}}',
 *   html: '<p>Hello {{name}}</p>',
 *   templateData: { name: 'John' }
 * });
 *
 * // Provider template
 * await send({
 *   to: 'user@example.com',
 *   templateId: 'd-abc123',
 *   templateData: { name: 'John' }
 * });
 *
 * // Bulk emails
 * await send([
 *   { to: 'user1@example.com', subject: 'Hi', html: '<p>Hello 1</p>' },
 *   { to: 'user2@example.com', subject: 'Hi', html: '<p>Hello 2</p>' }
 * ]);
 */
export async function send(emails, options = {}) {
  try {
    // Normalize to array
    const emailList = Array.isArray(emails) ? emails : [emails];

    if (emailList.length === 0) {
      throw new EmailError(
        'At least one email is required',
        'INVALID_INPUT',
        400,
      );
    }

    // Check if we should use worker (unless called from worker itself)
    if (!options.skipWorker) {
      const decision = makeSendDecision(emailList, options);

      if (options.useWorker || decision.shouldUseWorker) {
        return workerService.processSend(emailList, {
          ...options,
          skipWorker: true, // Prevent infinite loop
        });
      }
    }

    // Process directly
    const manager = new EmailManager(options);
    return processEmailsDirect(emailList, manager, options);
  } catch (error) {
    if (error instanceof EmailError) {
      return createResponse(false, null, error.message, error);
    }
    return createResponse(
      false,
      null,
      'Failed to send email',
      new EmailError(error.message, 'SEND_FAILED', 500),
    );
  }
}
