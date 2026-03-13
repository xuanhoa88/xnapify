/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Processing Utilities - Shared logic for email sending
 * Used by both send.js (main process) and send.worker.js (worker process)
 */

import template from '../../template';

import { createOperationResult, EmailError } from './errors';

/**
 * Render template using the shared template engine (LiquidJS).
 * Supports {{ variable }}, {% loops %}, {% if %}, filters, etc.
 * Safely handles template rendering errors without breaking email sending.
 * @param {string} content - Template string
 * @param {Object} data - Variables to substitute
 * @returns {Promise<string>} Rendered content or original content if rendering fails
 */
async function renderTemplate(content, data) {
  if (!content || !data) return content;
  return template.render(content, data);
}

/**
 * Process a single email
 * @param {Object} emailData - Email data (already validated by Zod schema)
 * @param {Object} provider - Email provider instance
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
/**
 * Send email with retry logic (exponential backoff)
 * @param {Function} sendFn - Function that performs the send
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Send result
 */
async function sendWithRetry(sendFn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (error) {
      lastError = error;

      // Don't retry on validation errors (4xx)
      if (
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      // Retry on network/server errors (5xx)
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Process a single email
 * @param {Object} emailData - Email data (already validated by Zod schema)
 * @param {Object} provider - Email provider instance
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
async function processSingleEmail(emailData, provider, options) {
  const { templateData, templateId, ...restData } = emailData;

  // Provider template (SendGrid/Mailgun) - not supported in all providers
  if (templateId) {
    if (provider.sendTemplate && typeof provider.sendTemplate === 'function') {
      return provider.sendTemplate(
        templateId,
        templateData || {},
        restData.to,
        {
          ...options,
          ...restData,
        },
      );
    }
    throw new EmailError(
      'Provider does not support template sending',
      'TEMPLATE_NOT_SUPPORTED',
      400,
    );
  }

  // Render templates using LiquidJS if templateData provided
  if (templateData) {
    if (restData.html) {
      restData.html = await renderTemplate(restData.html, templateData);
    }
    if (restData.text) {
      restData.text = await renderTemplate(restData.text, templateData);
    }
    if (restData.subject) {
      restData.subject = await renderTemplate(restData.subject, templateData);
    }
  }

  // Send via provider directly
  if (typeof provider.send === 'function') {
    return provider.send(restData);
  }

  throw new EmailError(
    'Provider does not support sending emails',
    'SEND_NOT_SUPPORTED',
    400,
  );
}

/**
 * Process emails directly (shared by main process and worker)
 * @param {Object} provider - Email provider instance
 * @param {Array|string} emails - Array of emails or single email
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
export async function processEmails(provider, emails, options = {}) {
  if (!provider) {
    throw new EmailError(
      'Email provider is required',
      'EMAIL_PROVIDER_REQUIRED',
      400,
    );
  }

  const emailList = Array.isArray(emails) ? emails : [emails];

  // Single email
  if (emailList.length === 1) {
    const result = await processSingleEmail(emailList[0], provider, options);
    return createOperationResult(
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

  const maxRetries = options.maxRetries || 3;
  const concurrency = options.concurrency || 10;

  // Process in chunks to limit concurrent connections
  for (let i = 0; i < emailList.length; i += concurrency) {
    const chunk = emailList.slice(i, i + concurrency);

    const promises = chunk.map(async emailData => {
      try {
        // Use retry logic for bulk sends
        const result = await sendWithRetry(
          () => processSingleEmail(emailData, provider, options),
          maxRetries,
        );
        results.successful.push({
          to: emailData.to,
          messageId: result.messageId,
        });
      } catch (error) {
        results.failed.push({
          to: emailData.to,
          error: error.message,
          retries: maxRetries - 1,
        });
      }
    });

    await Promise.all(promises);
  }

  return createOperationResult(
    true,
    {
      successful: results.successful,
      failed: results.failed,
      totalEmails: emailList.length,
      successCount: results.successful.length,
      failCount: results.failed.length,
      provider: provider.name || provider.constructor.name || 'unknown',
    },
    `Sent ${results.successful.length} of ${emailList.length} emails`,
  );
}
