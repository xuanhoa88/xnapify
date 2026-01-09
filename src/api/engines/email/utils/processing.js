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

import { Liquid } from 'liquidjs';
import { createResponse } from './errors';
import { createFactory } from '../factory';

// Create a reusable Liquid engine instance
const liquid = new Liquid();

/**
 * Render template using LiquidJS
 * Supports {{ variable }}, {% loops %}, {% if %}, filters, etc.
 * @param {string} content - Template string
 * @param {Object} data - Variables to substitute
 * @returns {Promise<string>} Rendered content
 */
export async function renderTemplate(content, data) {
  if (!content || !data) return content;
  return liquid.parseAndRender(content, data);
}

/**
 * Process a single email
 * @param {Object} emailData - Email data (already validated by Zod schema)
 * @param {EmailManager} manager - Email manager instance
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
export async function processSingleEmail(emailData, manager, options) {
  const { templateData, templateId, ...restData } = emailData;

  // Provider template (SendGrid/Mailgun)
  if (templateId) {
    return manager.sendTemplate(templateId, templateData || {}, restData.to, {
      ...options,
      ...restData,
    });
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

  // Send (data already validated by Zod in send.js)
  return manager.send(restData, options);
}

/**
 * Process emails directly (shared by main process and worker)
 * @param {Array} emailList - Array of emails
 * @param {Object} options - Send options
 * @returns {Promise<Object>} Send result
 */
export async function processEmails(emailList, options = {}) {
  const manager = createFactory(options);

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
