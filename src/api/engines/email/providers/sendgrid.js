/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fetch from 'node-fetch';
import { EmailError } from '../utils/errors';

/**
 * SendGrid Email Provider
 *
 * Provides email sending via SendGrid API.
 * Supports templates, dynamic content, and batch sending.
 */
export class SendGridEmailProvider {
  constructor(config = {}) {
    this.name = 'sendgrid';
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.sendgrid.com/v3/mail/send';
    this.defaultFrom = config.defaultFrom || null;
    this.defaultFromName = config.defaultFromName || null;

    if (!this.apiKey) {
      console.warn('SendGrid API key not provided');
    }

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Build SendGrid API headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Format recipients for SendGrid API
   * @param {string|Array} recipients - Recipients
   * @returns {Array} Formatted recipients array
   */
  formatRecipients(recipients) {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    return list.map(email => ({ email: email.trim() }));
  }

  /**
   * Build SendGrid mail payload
   * @param {Object} email - Email data
   * @returns {Object} SendGrid payload
   */
  buildPayload(email) {
    const from = email.from || this.defaultFrom;
    if (!from) {
      throw new EmailError('From address is required', 'INVALID_EMAIL', 400);
    }

    const payload = {
      personalizations: [
        {
          to: this.formatRecipients(email.to),
        },
      ],
      from: {
        email: from,
        name: email.fromName || this.defaultFromName,
      },
      subject: email.subject,
      content: [],
    };

    // Add CC if present
    if (email.cc) {
      payload.personalizations[0].cc = this.formatRecipients(email.cc);
    }

    // Add BCC if present
    if (email.bcc) {
      payload.personalizations[0].bcc = this.formatRecipients(email.bcc);
    }

    // Add content (prefer HTML)
    if (email.html) {
      payload.content.push({ type: 'text/html', value: email.html });
    }
    if (email.text) {
      payload.content.push({ type: 'text/plain', value: email.text });
    }

    // Add reply-to if present
    if (email.replyTo) {
      payload.reply_to = { email: email.replyTo };
    }

    // Add template ID if present
    if (email.templateId) {
      payload.template_id = email.templateId;
      if (email.templateData) {
        payload.personalizations[0].dynamic_template_data = email.templateData;
      }
    }

    // Add attachments if present
    if (email.attachments && email.attachments.length > 0) {
      payload.attachments = email.attachments.map(att => ({
        content: Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : att.content,
        filename: att.filename,
        type: att.contentType || 'application/octet-stream',
        disposition: att.disposition || 'attachment',
      }));
    }

    return payload;
  }

  /**
   * Send a single email
   * @param {Object} email - Email data
   * @returns {Promise<Object>} Send result
   */
  async send(email) {
    if (!this.apiKey) {
      throw new EmailError(
        'SendGrid API key not configured',
        'PROVIDER_ERROR',
        500,
      );
    }

    try {
      const payload = this.buildPayload(email);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.errors && errorData.errors[0]
            ? errorData.errors[0].message
            : `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return {
        success: true,
        messageId: response.headers.get('x-message-id'),
        provider: 'sendgrid',
      };
    } catch (error) {
      this.stats.failed++;
      throw new EmailError(
        `SendGrid send failed: ${error.message}`,
        'SEND_FAILED',
      );
    }
  }

  /**
   * Send multiple emails
   * @param {Array} emails - Array of email objects
   * @returns {Promise<Object>} Batch send result
   */
  async sendBulk(emails) {
    const results = {
      successful: [],
      failed: [],
      total: emails.length,
    };

    for (const email of emails) {
      try {
        const result = await this.send(email);
        results.successful.push({
          to: email.to,
          messageId: result.messageId,
        });
      } catch (error) {
        results.failed.push({
          to: email.to,
          error: error.message,
        });
      }
    }

    return {
      ...results,
      successCount: results.successful.length,
      failCount: results.failed.length,
      provider: 'sendgrid',
    };
  }

  /**
   * Send email using SendGrid template
   * @param {string} templateId - SendGrid template ID
   * @param {Object} data - Dynamic template data
   * @param {string|Array} recipients - Recipient(s)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendTemplate(templateId, data, recipients, options = {}) {
    return this.send({
      to: recipients,
      templateId,
      templateData: data,
      from: options.from,
      fromName: options.fromName,
      subject: options.subject || '', // Subject can be in template
    });
  }

  /**
   * Verify SendGrid API connection
   * @returns {Promise<Object>} Verification result
   */
  async verify() {
    if (!this.apiKey) {
      throw new EmailError(
        'SendGrid API key not configured',
        'CONNECTION_FAILED',
      );
    }

    try {
      // Use a simple API call to verify the key
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        success: true,
        message: 'SendGrid API connection verified',
        provider: 'sendgrid',
      };
    } catch (error) {
      throw new EmailError(
        `SendGrid verification failed: ${error.message}`,
        'CONNECTION_FAILED',
      );
    }
  }

  /**
   * Get provider statistics
   * @returns {Object} Provider stats
   */
  getStats() {
    return {
      provider: 'sendgrid',
      configured: !!this.apiKey,
      ...this.stats,
    };
  }
}
