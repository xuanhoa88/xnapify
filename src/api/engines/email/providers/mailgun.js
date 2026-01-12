/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fetch from 'node-fetch';
import { EmailError } from '../utils';

/**
 * Mailgun Email Provider
 *
 * Provides email sending via Mailgun API.
 * Supports templates, batch sending, and tracking.
 */
export class MailgunEmailProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.region = config.region || 'us'; // 'us' or 'eu'
    this.defaultFrom = config.defaultFrom || null;
    this.defaultFromName = config.defaultFromName || null;

    this.baseUrl =
      this.region === 'eu'
        ? 'https://api.eu.mailgun.net/v3'
        : 'https://api.mailgun.net/v3';

    if (!this.apiKey || !this.domain) {
      console.warn('Mailgun API key or domain not provided');
    }

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Build Mailgun API headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    const credentials = Buffer.from(`api:${this.apiKey}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
    };
  }

  /**
   * Format from address with optional name
   * @param {string} from - From email address
   * @param {string} fromName - From name
   * @returns {string} Formatted from address
   */
  formatFrom(from, fromName) {
    const email = from || this.defaultFrom;
    const name = fromName || this.defaultFromName;

    if (!email) {
      throw new EmailError('From address is required', 'INVALID_EMAIL', 400);
    }

    if (name) {
      return `${name} <${email}>`;
    }
    return email;
  }

  /**
   * Build form data for Mailgun API
   * @param {Object} email - Email data
   * @returns {FormData} Form data object
   */
  buildFormData(email) {
    const formData = new FormData();

    formData.append('from', this.formatFrom(email.from, email.fromName));

    // Add recipients
    const recipients = Array.isArray(email.to) ? email.to : [email.to];
    recipients.forEach(to => formData.append('to', to));

    formData.append('subject', email.subject);

    // Add body
    if (email.html) {
      formData.append('html', email.html);
    }
    if (email.text) {
      formData.append('text', email.text);
    }

    // Add CC if present
    if (email.cc) {
      const ccList = Array.isArray(email.cc) ? email.cc : [email.cc];
      ccList.forEach(cc => formData.append('cc', cc));
    }

    // Add BCC if present
    if (email.bcc) {
      const bccList = Array.isArray(email.bcc) ? email.bcc : [email.bcc];
      bccList.forEach(bcc => formData.append('bcc', bcc));
    }

    // Add reply-to if present
    if (email.replyTo) {
      formData.append('h:Reply-To', email.replyTo);
    }

    // Add custom headers if present
    if (email.headers) {
      Object.entries(email.headers).forEach(([key, value]) => {
        formData.append(`h:${key}`, value);
      });
    }

    // Add template if present (support both template and templateId)
    const templateName = email.template || email.templateId;
    if (templateName) {
      formData.append('template', templateName);
      if (email.templateData) {
        formData.append(
          'h:X-Mailgun-Variables',
          JSON.stringify(email.templateData),
        );
      }
    }

    // Add attachments if present
    if (email.attachments && email.attachments.length > 0) {
      email.attachments.forEach(att => {
        const blob = new Blob([att.content], {
          type: att.contentType || 'application/octet-stream',
        });
        formData.append('attachment', blob, att.filename);
      });
    }

    return formData;
  }

  /**
   * Send a single email
   * @param {Object} email - Email data
   * @returns {Promise<Object>} Send result
   */
  async send(email) {
    if (!this.apiKey || !this.domain) {
      throw new EmailError(
        'Mailgun API key and domain are required',
        'PROVIDER_ERROR',
        500,
      );
    }

    try {
      const formData = this.buildFormData(email);
      const url = `${this.baseUrl}/${this.domain}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return {
        success: true,
        messageId: result.id,
        message: result.message,
        provider: 'mailgun',
      };
    } catch (error) {
      this.stats.failed++;
      throw new EmailError(
        `Mailgun send failed: ${error.message}`,
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
      provider: 'mailgun',
    };
  }

  /**
   * Send email using Mailgun template
   * @param {string} templateName - Mailgun template name
   * @param {Object} variables - Template variables
   * @param {string|Array} recipients - Recipient(s)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendTemplate(templateName, variables, recipients, options = {}) {
    return this.send({
      to: recipients,
      templateId: templateName,
      templateData: variables,
      from: options.from,
      fromName: options.fromName,
      subject: options.subject || '', // Subject can be in template
    });
  }

  /**
   * Verify Mailgun API connection
   * @returns {Promise<Object>} Verification result
   */
  async verify() {
    if (!this.apiKey || !this.domain) {
      throw new EmailError(
        'Mailgun API key and domain are required',
        'CONNECTION_FAILED',
      );
    }

    try {
      const url = `${this.baseUrl}/domains/${this.domain}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        success: true,
        message: 'Mailgun API connection verified',
        provider: 'mailgun',
      };
    } catch (error) {
      throw new EmailError(
        `Mailgun verification failed: ${error.message}`,
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
      provider: 'mailgun',
      domain: this.domain,
      region: this.region,
      configured: !!(this.apiKey && this.domain),
      ...this.stats,
    };
  }
}
