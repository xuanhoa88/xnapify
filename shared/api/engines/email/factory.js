/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SmtpEmailProvider } from './providers/smtp';
import { SendGridEmailProvider } from './providers/sendgrid';
import { MailgunEmailProvider } from './providers/mailgun';
import { MemoryEmailProvider } from './providers/memory';
import { send } from './services';

/**
 * Email Manager
 *
 * Manages multiple email providers and provides a unified send interface.
 * Handles validation, worker decisions, and response formatting.
 */
export class EmailManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.defaultProvider =
      config.provider || process.env.RSK_MAIL_PROVIDER || 'smtp';
    this.config = config;

    // Worker thresholds (can be overridden globally)
    this.workerThresholds = {
      batchSize: 5,
      largeBodySize: 100 * 1024,
      ...config.workerThresholds,
    };

    // Initialize default providers
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default email providers based on configuration
   * @private
   */
  initializeDefaultProviders() {
    // Always add memory provider (for testing)
    this.providers.set(
      'memory',
      new MemoryEmailProvider(this.config.memory || {}),
    );

    // SMTP provider (if configured)
    if (
      this.config.smtp ||
      process.env.RSK_SMTP_HOST ||
      this.defaultProvider === 'smtp'
    ) {
      this.providers.set(
        'smtp',
        new SmtpEmailProvider(
          this.config.smtp || {
            host: process.env.RSK_SMTP_HOST,
            port: parseInt(process.env.RSK_SMTP_PORT, 10) || 587,
            secure: process.env.RSK_SMTP_SECURE === 'true',
            user: process.env.RSK_SMTP_USER,
            pass: process.env.RSK_SMTP_PASS,
            defaultFrom: process.env.RSK_MAIL_FROM,
            defaultFromName:
              process.env.RSK_MAIL_FROM_NAME || process.env.RSK_APP_NAME,
          },
        ),
      );
    }

    // SendGrid provider (if configured)
    if (this.config.sendgrid || process.env.RSK_SENDGRID_KEY) {
      this.providers.set(
        'sendgrid',
        new SendGridEmailProvider(
          this.config.sendgrid || {
            apiKey: process.env.RSK_SENDGRID_KEY,
            defaultFrom: process.env.RSK_MAIL_FROM,
            defaultFromName: process.env.RSK_MAIL_FROM_NAME,
          },
        ),
      );
    }

    // Mailgun provider (if configured)
    if (
      this.config.mailgun ||
      (process.env.RSK_MAILGUN_KEY && process.env.RSK_MAILGUN_DOMAIN)
    ) {
      this.providers.set(
        'mailgun',
        new MailgunEmailProvider(
          this.config.mailgun || {
            apiKey: process.env.RSK_MAILGUN_KEY,
            domain: process.env.RSK_MAILGUN_DOMAIN,
            region: process.env.RSK_MAILGUN_REGION || 'us',
            defaultFrom: process.env.RSK_MAIL_FROM,
            defaultFromName: process.env.RSK_MAIL_FROM_NAME,
          },
        ),
      );
    }
  }

  /**
   * Add a custom email provider
   * @param {string} name - Provider name
   * @param {Object} provider - Provider instance (must implement send method)
   * @returns {boolean} True if added, false if already exists
   */
  addProvider(name, provider) {
    if (this.providers.has(name)) {
      console.warn(
        `⚠️ Email provider "${name}" already exists. Cannot override.`,
      );
      return false;
    }
    this.providers.set(name, provider);
    console.info(`✅ Registered email provider: ${name}`);
    return true;
  }

  /**
   * Get provider by name
   * @param {string} name - Provider name
   * @returns {Object|null} Provider instance or null
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Get list of registered provider names
   * @returns {Array<string>} Array of provider names
   */
  getProviderNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider exists
   * @param {string} name - Provider name
   * @returns {boolean} True if provider exists
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * Get statistics from all providers
   * @returns {Object} Stats object keyed by provider name
   */
  getAllStats() {
    const stats = {};
    for (const [name, provider] of this.providers) {
      try {
        if (provider.getStats && typeof provider.getStats === 'function') {
          stats[name] = provider.getStats();
        } else {
          stats[name] = { available: false };
        }
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }
    return stats;
  }

  /**
   * Cleanup - close all providers
   * Called automatically on process termination
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.info('🧹 Cleaning up email engine...');

    for (const [name, provider] of this.providers) {
      try {
        if (provider.close && typeof provider.close === 'function') {
          await provider.close();
          console.info(`✅ Closed email provider: ${name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to close provider ${name}:`, error.message);
      }
    }

    this.providers.clear();
    console.info('✅ Email engine cleanup complete');
  }

  /**
   * Send email(s)
   * Delegates to send service which handles validation, worker decisions, and processing.
   *
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
   * // Single email (auto-decides, usually direct)
   * await email.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
   *
   * @example
   * // Force worker processing
   * await email.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' }, {
   *   useWorker: true
   * });
   *
   * @example
   * // Force direct processing (bypass worker even for batch)
   * await email.send(largeEmailList, { useWorker: false });
   *
   * @example
   * // Bulk emails (auto-offloads to worker for 5+ emails)
   * await email.send([
   *   { to: 'user1@example.com', subject: 'Hi', html: '<p>Hello 1</p>' },
   *   { to: 'user2@example.com', subject: 'Hi', html: '<p>Hello 2</p>' }
   * ]);
   *
   * @example
   * // Custom thresholds
   * await email.send(emailList, {
   *   batchThreshold: 3,        // Use worker for 3+ emails
   *   largeBodyThreshold: 50000 // Use worker for 50KB+ bodies
   * });
   */
  async send(emails, options = {}) {
    return send(this, emails, options);
  }
}

/**
 * Create a new isolated EmailManager instance
 * Useful for testing or isolated email contexts
 *
 * @param {Object} config - Email manager configuration
 * @param {string} [config.provider='smtp'] - Default provider
 * @param {Object} [config.smtp] - SMTP configuration
 * @param {Object} [config.sendgrid] - SendGrid configuration
 * @param {Object} [config.mailgun] - Mailgun configuration
 * @param {Object} [config.memory] - Memory provider configuration
 * @returns {EmailManager} New manager instance
 */
export function createFactory(config = {}) {
  const manager = new EmailManager(config);
  return manager;
}
