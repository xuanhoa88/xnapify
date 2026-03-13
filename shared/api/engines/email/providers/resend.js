/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fetch from 'node-fetch';

import { EmailError } from '../utils/errors';

/**
 * Resend Email Provider
 *
 * Provides email sending via Resend API.
 */
export class ResendEmailProvider {
  constructor(config = {}) {
    this.name = 'resend';
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.resend.com/emails';
    this.defaultFrom = config.defaultFrom || null;
    this.defaultFromName = config.defaultFromName || null;

    if (!this.apiKey) {
      console.warn('Resend API key not provided');
    }

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Build Resend API headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Format recipients for Resend API
   * @param {string|Array} recipients - Recipients
   * @returns {Array} Formatted recipients array of strings
   */
  formatRecipients(recipients) {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    return list;
  }

  /**
   * Build Resend mail payload
   * @param {Object} email - Email data
   * @returns {Object} Resend payload
   */
  buildPayload(email) {
    const fromEmail = email.from || this.defaultFrom;
    if (!fromEmail) {
      throw new EmailError('From address is required', 'INVALID_EMAIL', 400);
    }

    const fromName = email.fromName || this.defaultFromName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const payload = {
      from,
      to: this.formatRecipients(email.to),
      subject: email.subject,
    };

    // Add CC if present
    if (email.cc) {
      payload.cc = this.formatRecipients(email.cc);
    }

    // Add BCC if present
    if (email.bcc) {
      payload.bcc = this.formatRecipients(email.bcc);
    }

    // Add content
    if (email.html) {
      payload.html = email.html;
    } else if (email.text) {
      payload.text = email.text;
    }

    // Add reply-to if present
    if (email.replyTo) {
      payload.reply_to = email.replyTo;
    }

    // Add attachments if present
    if (email.attachments && email.attachments.length > 0) {
      payload.attachments = email.attachments.map(att => {
        const content = Buffer.isBuffer(att.content)
          ? Array.from(att.content)
          : att.content;

        return {
          filename: att.filename,
          content: content,
        };
      });
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
        'Resend API key not configured',
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
        const errorMessage = errorData.message || `HTTP ${response.status}`;
        throw new EmailError(
          errorMessage,
          'RESEND_SEND_ERROR',
          response.status,
        );
      }

      const responseData = await response.json();

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return {
        success: true,
        messageId: responseData.id,
        provider: 'resend',
      };
    } catch (err) {
      this.stats.failed++;
      const error =
        err instanceof EmailError
          ? err
          : new EmailError(`Resend send failed: ${err.message}`, 'SEND_FAILED');
      throw error;
    }
  }

  /**
   * Send multiple emails
   * Resend has a batch endpoint: https://api.resend.com/emails/batch
   * @param {Array} emails - Array of email objects
   * @returns {Promise<Object>} Batch send result
   */
  async sendBulk(emails) {
    // For simplicity, we can do sequential sending or use the batch endpoint.
    // We will do sequential to collect successes and failures, similar to other providers
    const results = {
      successful: [],
      failed: [],
      total: emails.length,
    };

    // Actually we can use the batch API for resend since it is natively supported,
    // but let's match sendgrid and mailgun interfaces first. Or we can use the loop.
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
      provider: 'resend',
    };
  }

  /**
   * Verify Resend API connection
   * @returns {Promise<Object>} Verification result
   */
  async verify() {
    if (!this.apiKey) {
      throw new EmailError(
        'Resend API key not configured',
        'CONNECTION_FAILED',
      );
    }

    try {
      // Just test an empty emails fetch or similar to verify auth.
      // The Resend API has /api-keys to get API keys, which serves as a good check.
      const response = await fetch('https://api.resend.com/api-keys', {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new EmailError(
          `HTTP ${response.status}`,
          'CONNECTION_FAILED',
          response.status,
        );
      }

      return {
        success: true,
        message: 'Resend API connection verified',
        provider: 'resend',
      };
    } catch (error) {
      throw new EmailError(
        `Resend verification failed: ${error.message}`,
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
      provider: 'resend',
      configured: !!this.apiKey,
      ...this.stats,
    };
  }
}
