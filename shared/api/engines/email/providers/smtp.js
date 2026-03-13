/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import nodemailer from 'nodemailer';

import { EmailError } from '../utils/errors';

/**
 * SMTP Email Provider
 *
 * Provides email sending via SMTP using nodemailer.
 * Supports authentication, TLS/SSL, and connection pooling.
 */
export class SmtpEmailProvider {
  constructor(config = {}) {
    this.name = 'smtp';
    this.host = config.host || 'localhost';
    this.port = config.port || 587;
    this.secure = config.secure !== undefined ? config.secure : false;
    this.auth =
      config.auth ||
      (config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : null);
    this.pool = config.pool !== undefined ? config.pool : true;
    this.maxConnections = config.maxConnections || 5;
    this.maxMessages = config.maxMessages || 100;
    this.defaultFrom = config.defaultFrom || null;
    this.defaultFromName = config.defaultFromName || null;

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };

    // Create transporter lazily
    this.transporter = null;
  }

  /**
   * Get or create nodemailer transporter
   * @returns {Object} Nodemailer transporter
   */
  getTransporter() {
    if (!this.transporter) {
      const transportConfig = {
        host: this.host,
        port: this.port,
        secure: this.secure,
        pool: this.pool,
        maxConnections: this.maxConnections,
        maxMessages: this.maxMessages,
      };

      if (this.auth) {
        transportConfig.auth = this.auth;
      }

      this.transporter = nodemailer.createTransport(transportConfig);
    }
    return this.transporter;
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
      return `"${name}" <${email}>`;
    }
    return email;
  }

  /**
   * Send a single email
   * @param {Object} email - Email data
   * @param {string|Array} email.to - Recipient(s)
   * @param {string} email.subject - Subject line
   * @param {string} [email.html] - HTML body
   * @param {string} [email.text] - Plain text body
   * @param {string} [email.from] - Sender address
   * @param {string} [email.fromName] - Sender name
   * @param {Array} [email.cc] - CC recipients
   * @param {Array} [email.bcc] - BCC recipients
   * @param {Array} [email.attachments] - Attachments
   * @param {string} [email.replyTo] - Reply-to address
   * @param {Object} [email.headers] - Custom headers
   * @returns {Promise<Object>} Send result
   */
  async send(email) {
    try {
      const transporter = this.getTransporter();

      const mailOptions = {
        from: this.formatFrom(email.from, email.fromName),
        to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      };

      if (email.cc) {
        mailOptions.cc = Array.isArray(email.cc)
          ? email.cc.join(', ')
          : email.cc;
      }

      if (email.bcc) {
        mailOptions.bcc = Array.isArray(email.bcc)
          ? email.bcc.join(', ')
          : email.bcc;
      }

      if (email.replyTo) {
        mailOptions.replyTo = email.replyTo;
      }

      if (email.attachments) {
        mailOptions.attachments = email.attachments;
      }

      if (email.headers) {
        mailOptions.headers = email.headers;
      }

      const result = await transporter.sendMail(mailOptions);

      this.stats.sent++;
      this.stats.lastSentAt = new Date().toISOString();

      return {
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        provider: 'smtp',
      };
    } catch (error) {
      this.stats.failed++;
      throw new EmailError(`SMTP send failed: ${error.message}`, 'SEND_FAILED');
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
      provider: 'smtp',
    };
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<Object>} Verification result
   */
  async verify() {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return {
        success: true,
        message: 'SMTP connection verified',
        provider: 'smtp',
      };
    } catch (error) {
      throw new EmailError(
        `SMTP verification failed: ${error.message}`,
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
      provider: 'smtp',
      host: this.host,
      port: this.port,
      secure: this.secure,
      pool: this.pool,
      ...this.stats,
    };
  }

  /**
   * Close the transporter connection pool
   */
  async close() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
