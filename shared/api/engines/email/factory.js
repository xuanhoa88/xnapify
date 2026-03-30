/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { MailgunEmailProvider } from './providers/mailgun';
import { MemoryEmailProvider } from './providers/memory';
import { ResendEmailProvider } from './providers/resend';
import { SendGridEmailProvider } from './providers/sendgrid';
import { SmtpEmailProvider } from './providers/smtp';
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
    this.config = config;

    // Worker thresholds (can be overridden globally)
    this.workerThresholds = {
      batchSize: 5,
      largeBodySize: 100 * 1024,
      ...config.workerThresholds,
    };

    // Always add memory provider (for testing)
    this.providers.set(
      'memory',
      new MemoryEmailProvider(this.config.memory || {}),
    );
  }

  /**
   * Get default provider name dynamically (lazy evaluated)
   */
  get defaultProvider() {
    return (
      this.config.provider || process.env.XNAPIFY_MAIL_PROVIDER || 'resend'
    );
  }

  /**
   * Lazily initialize providers when requested, catching late-loaded dotenv configs
   */
  lazyInitProvider(name) {
    if (this.providers.has(name)) return;

    if (
      name === 'smtp' &&
      (this.config.smtp ||
        process.env.XNAPIFY_SMTP_HOST ||
        this.defaultProvider === 'smtp')
    ) {
      const smtpHost =
        (this.config.smtp && this.config.smtp.host) ||
        process.env.XNAPIFY_SMTP_HOST;
      if (!smtpHost && this.defaultProvider === 'smtp') {
        console.warn(
          '⚠️ SMTP is the default email provider but XNAPIFY_SMTP_HOST is not set. Emails will fail.',
        );
      }
      this.providers.set(
        'smtp',
        new SmtpEmailProvider(
          this.config.smtp || {
            host: process.env.XNAPIFY_SMTP_HOST,
            port: parseInt(process.env.XNAPIFY_SMTP_PORT, 10) || 587,
            secure: process.env.XNAPIFY_SMTP_SECURE === 'true',
            user: process.env.XNAPIFY_SMTP_USER,
            pass: process.env.XNAPIFY_SMTP_PASS,
            defaultFrom: process.env.XNAPIFY_MAIL_FROM,
            defaultFromName:
              process.env.XNAPIFY_MAIL_FROM_NAME ||
              process.env.XNAPIFY_APP_NAME,
          },
        ),
      );
    } else if (
      name === 'resend' &&
      (this.config.resend || process.env.XNAPIFY_RESEND_KEY)
    ) {
      this.providers.set(
        'resend',
        new ResendEmailProvider(
          this.config.resend || {
            apiKey: process.env.XNAPIFY_RESEND_KEY,
            defaultFrom: process.env.XNAPIFY_MAIL_FROM,
            defaultFromName:
              process.env.XNAPIFY_MAIL_FROM_NAME ||
              process.env.XNAPIFY_APP_NAME,
          },
        ),
      );
    } else if (
      name === 'sendgrid' &&
      (this.config.sendgrid || process.env.XNAPIFY_SENDGRID_KEY)
    ) {
      this.providers.set(
        'sendgrid',
        new SendGridEmailProvider(
          this.config.sendgrid || {
            apiKey: process.env.XNAPIFY_SENDGRID_KEY,
            defaultFrom: process.env.XNAPIFY_MAIL_FROM,
            defaultFromName:
              process.env.XNAPIFY_MAIL_FROM_NAME ||
              process.env.XNAPIFY_APP_NAME,
          },
        ),
      );
    } else if (
      name === 'mailgun' &&
      (this.config.mailgun || process.env.XNAPIFY_MAILGUN_KEY)
    ) {
      this.providers.set(
        'mailgun',
        new MailgunEmailProvider(
          this.config.mailgun || {
            apiKey: process.env.XNAPIFY_MAILGUN_KEY,
            domain: process.env.XNAPIFY_MAILGUN_DOMAIN,
            region: process.env.XNAPIFY_MAILGUN_REGION || 'us',
            defaultFrom: process.env.XNAPIFY_MAIL_FROM,
            defaultFromName:
              process.env.XNAPIFY_MAIL_FROM_NAME ||
              process.env.XNAPIFY_APP_NAME,
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
    this.lazyInitProvider(name);
    return this.providers.get(name) || null;
  }

  /**
   * Get list of registered provider names
   * @returns {Array<string>} Array of provider names
   */
  getProviderNames() {
    // Attempt to init standard providers to reflect availability
    ['smtp', 'resend', 'sendgrid', 'mailgun'].forEach(p =>
      this.lazyInitProvider(p),
    );
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider exists
   * @param {string} name - Provider name
   * @returns {boolean} True if provider exists
   */
  hasProvider(name) {
    this.lazyInitProvider(name);
    return this.providers.has(name);
  }

  /**
   * Get statistics from all providers
   * @returns {Object} Stats object keyed by provider name
   */
  getAllStats() {
    this.getProviderNames(); // Ensure all available are initialized
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
 * @param {Object} [config.resend] - Resend configuration
 * @param {Object} [config.memory] - Memory provider configuration
 * @returns {EmailManager} New manager instance
 */
export function createFactory(config = {}) {
  const manager = new EmailManager(config);
  return manager;
}
