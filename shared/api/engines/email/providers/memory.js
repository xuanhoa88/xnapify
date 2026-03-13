/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

import { EmailError } from '../utils/errors';

/**
 * Memory Email Provider
 *
 * In-memory email provider for testing and development.
 * Stores all sent emails in memory for verification.
 */
export class MemoryEmailProvider {
  constructor(config = {}) {
    this.name = 'memory';
    this.defaultFrom = config.defaultFrom || 'test@example.com';
    this.defaultFromName = config.defaultFromName || 'Test Sender';
    this.maxStoredEmails = config.maxStoredEmails || 1000;
    this.simulateDelay = config.simulateDelay || 0; // ms
    this.failureRate = config.failureRate || 0; // 0-1, for testing failures

    // Storage
    this.sentEmails = [];
    this.failedEmails = [];

    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
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

    if (name) {
      return `"${name}" <${email}>`;
    }
    return email;
  }

  /**
   * Simulate network delay if configured
   */
  async delay() {
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
    }
  }

  /**
   * Check if should simulate failure based on failure rate
   * @returns {boolean} True if should fail
   */
  shouldFail() {
    return this.failureRate > 0 && Math.random() < this.failureRate;
  }

  /**
   * Send a single email (stores in memory)
   * @param {Object} email - Email data
   * @returns {Promise<Object>} Send result
   */
  async send(email) {
    await this.delay();

    // Simulate random failures for testing
    if (this.shouldFail()) {
      this.stats.failed++;
      const failedEmail = {
        ...email,
        error: 'Simulated failure',
        failedAt: new Date().toISOString(),
      };
      this.failedEmails.push(failedEmail);

      throw new EmailError('Simulated email failure', 'SIMULATED_FAILURE', 500);
    }

    const messageId = `memory-${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const storedEmail = {
      id: messageId,
      from: this.formatFrom(email.from, email.fromName),
      to: Array.isArray(email.to) ? email.to : [email.to],
      cc: email.cc
        ? Array.isArray(email.cc)
          ? email.cc
          : [email.cc]
        : undefined,
      bcc: email.bcc
        ? Array.isArray(email.bcc)
          ? email.bcc
          : [email.bcc]
        : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: email.replyTo,
      attachments: email.attachments
        ? email.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: Buffer.isBuffer(a.content) ? a.content.length : 0,
          }))
        : undefined,
      headers: email.headers,
      sentAt: timestamp,
      provider: 'memory',
    };

    // Add to storage (with limit)
    this.sentEmails.push(storedEmail);
    if (this.sentEmails.length > this.maxStoredEmails) {
      this.sentEmails.shift(); // Remove oldest
    }

    this.stats.sent++;
    this.stats.lastSentAt = timestamp;

    return {
      success: true,
      messageId,
      accepted: storedEmail.to,
      provider: 'memory',
    };
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
      provider: 'memory',
    };
  }

  /**
   * Verify connection (always succeeds for memory provider)
   * @returns {Promise<Object>} Verification result
   */
  async verify() {
    await this.delay();
    return {
      success: true,
      message: 'Memory provider is always available',
      provider: 'memory',
    };
  }

  /**
   * Get all sent emails
   * @param {Object} options - Filter options
   * @param {string} [options.to] - Filter by recipient
   * @param {string} [options.subject] - Filter by subject (contains)
   * @param {Date} [options.since] - Filter by sent date
   * @param {number} [options.limit] - Max emails to return
   * @returns {Array} Sent emails
   */
  getSentEmails(options = {}) {
    let emails = [...this.sentEmails];

    if (options.to) {
      emails = emails.filter(e =>
        e.to.some(recipient =>
          recipient.toLowerCase().includes(options.to.toLowerCase()),
        ),
      );
    }

    if (options.subject) {
      emails = emails.filter(e =>
        e.subject.toLowerCase().includes(options.subject.toLowerCase()),
      );
    }

    if (options.since) {
      const sinceDate = new Date(options.since);
      emails = emails.filter(e => new Date(e.sentAt) >= sinceDate);
    }

    if (options.limit) {
      emails = emails.slice(-options.limit);
    }

    return emails;
  }

  /**
   * Get a specific email by message ID
   * @param {string} messageId - Message ID
   * @returns {Object|null} Email or null if not found
   */
  getEmailById(messageId) {
    return this.sentEmails.find(e => e.id === messageId) || null;
  }

  /**
   * Get the last sent email
   * @returns {Object|null} Last email or null
   */
  getLastEmail() {
    return this.sentEmails.length > 0
      ? this.sentEmails[this.sentEmails.length - 1]
      : null;
  }

  /**
   * Get failed emails
   * @returns {Array} Failed emails
   */
  getFailedEmails() {
    return [...this.failedEmails];
  }

  /**
   * Clear all stored emails
   */
  clear() {
    this.sentEmails = [];
    this.failedEmails = [];
    this.stats = {
      sent: 0,
      failed: 0,
      lastSentAt: null,
    };
  }

  /**
   * Get provider statistics
   * @returns {Object} Provider stats
   */
  getStats() {
    return {
      provider: 'memory',
      storedEmails: this.sentEmails.length,
      maxStoredEmails: this.maxStoredEmails,
      simulateDelay: this.simulateDelay,
      failureRate: this.failureRate,
      ...this.stats,
    };
  }
}
