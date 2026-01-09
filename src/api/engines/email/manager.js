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
import { EmailError, DEFAULT_PROVIDER } from './utils';

/**
 * Email Manager
 *
 * Manages multiple email providers and provides a unified interface.
 * Supports multiple backends with automatic failover.
 */
export class EmailManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.defaultProvider = config.defaultProvider || DEFAULT_PROVIDER;
    this.config = config;

    // Initialize default providers
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default email providers based on configuration
   */
  initializeDefaultProviders() {
    // Always add memory provider (for testing)
    this.addProvider(
      'memory',
      new MemoryEmailProvider(this.config.memory || {}),
    );

    // SMTP provider (if configured)
    if (
      this.config.smtp ||
      process.env.RSK_EMAIL_SMTP_HOST ||
      this.defaultProvider === 'smtp'
    ) {
      this.addProvider(
        'smtp',
        new SmtpEmailProvider(
          this.config.smtp || {
            host: process.env.RSK_EMAIL_SMTP_HOST,
            port: parseInt(process.env.RSK_EMAIL_SMTP_PORT, 10) || 587,
            secure: process.env.RSK_EMAIL_SMTP_SECURE === 'true',
            user: process.env.RSK_EMAIL_SMTP_USER,
            pass: process.env.RSK_EMAIL_SMTP_PASS,
            defaultFrom: process.env.RSK_EMAIL_DEFAULT_FROM,
            defaultFromName: process.env.RSK_EMAIL_DEFAULT_FROM_NAME,
          },
        ),
      );
    }

    // SendGrid provider (if configured)
    if (this.config.sendgrid || process.env.RSK_EMAIL_SENDGRID_API_KEY) {
      this.addProvider(
        'sendgrid',
        new SendGridEmailProvider(
          this.config.sendgrid || {
            apiKey: process.env.RSK_EMAIL_SENDGRID_API_KEY,
            defaultFrom: process.env.RSK_EMAIL_DEFAULT_FROM,
            defaultFromName: process.env.RSK_EMAIL_DEFAULT_FROM_NAME,
          },
        ),
      );
    }

    // Mailgun provider (if configured)
    if (
      this.config.mailgun ||
      (process.env.RSK_EMAIL_MAILGUN_API_KEY &&
        process.env.RSK_EMAIL_MAILGUN_DOMAIN)
    ) {
      this.addProvider(
        'mailgun',
        new MailgunEmailProvider(
          this.config.mailgun || {
            apiKey: process.env.RSK_EMAIL_MAILGUN_API_KEY,
            domain: process.env.RSK_EMAIL_MAILGUN_DOMAIN,
            region: process.env.RSK_EMAIL_MAILGUN_REGION || 'us',
            defaultFrom: process.env.RSK_EMAIL_DEFAULT_FROM,
            defaultFromName: process.env.RSK_EMAIL_DEFAULT_FROM_NAME,
          },
        ),
      );
    }
  }

  /**
   * Add an email provider
   * @param {string} name - Provider name
   * @param {Object} provider - Provider instance
   * @returns {EmailManager} This manager for chaining
   */
  addProvider(name, provider) {
    this.providers.set(name, provider);
    return this;
  }

  /**
   * Remove an email provider
   * @param {string} name - Provider name
   * @returns {boolean} True if provider was removed
   */
  removeProvider(name) {
    if (name === this.defaultProvider) {
      const error = new Error('Cannot remove the default provider');
      error.name = 'InvalidEmailProviderError';
      error.status = 400;
      throw error;
    }
    return this.providers.delete(name);
  }

  /**
   * Get an email provider
   * @param {string} name - Provider name (optional, uses default if not specified)
   * @returns {Object} Provider instance
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      const error = new EmailError(
        `Email provider not found: ${providerName}`,
        'PROVIDER_NOT_FOUND',
        404,
      );
      throw error;
    }

    return provider;
  }

  /**
   * List available providers
   * @returns {Array<string>} Provider names
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Set the default provider
   * @param {string} name - Provider name
   * @returns {EmailManager} This manager for chaining
   */
  setDefaultProvider(name) {
    if (!this.providers.has(name)) {
      throw new EmailError(
        `Email provider not found: ${name}`,
        'PROVIDER_NOT_FOUND',
        404,
      );
    }
    this.defaultProvider = name;
    return this;
  }

  /**
   * Send a single email
   * @param {Object} email - Email data
   * @param {Object} options - Send options
   * @param {string} [options.provider] - Specific provider to use
   * @returns {Promise<Object>} Send result
   */
  async send(email, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.send(email);
  }

  /**
   * Send multiple emails
   * @param {Array} emails - Array of email objects
   * @param {Object} options - Send options
   * @param {string} [options.provider] - Specific provider to use
   * @returns {Promise<Object>} Batch send result
   */
  async sendBulk(emails, options = {}) {
    const provider = this.getProvider(options.provider);
    return await provider.sendBulk(emails);
  }

  /**
   * Send a template-based email
   * @param {string} templateId - Template identifier
   * @param {Object} data - Template data/variables
   * @param {string|Array} recipients - Recipient(s)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendTemplate(templateId, data, recipients, options = {}) {
    const provider = this.getProvider(options.provider);

    // Check if provider supports templates
    if (typeof provider.sendTemplate === 'function') {
      return await provider.sendTemplate(templateId, data, recipients, options);
    }

    // Fallback: Template not supported, throw error
    throw new EmailError(
      `Provider ${options.provider || this.defaultProvider} does not support templates`,
      'INVALID_TEMPLATE',
      400,
    );
  }

  /**
   * Verify provider connection
   * @param {string} providerName - Provider to verify (optional)
   * @returns {Promise<Object>} Verification result
   */
  async verify(providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.verify();
  }

  /**
   * Get statistics for all providers
   * @returns {Object} Provider statistics
   */
  async getStats() {
    const stats = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        stats[name] = provider.getStats();
      } catch (error) {
        stats[name] = {
          provider: name,
          error: error.message,
        };
      }
    }

    return {
      defaultProvider: this.defaultProvider,
      providers: stats,
      totalProviders: this.providers.size,
    };
  }

  /**
   * Close all provider connections
   */
  async close() {
    for (const [, provider] of this.providers.entries()) {
      if (typeof provider.close === 'function') {
        await provider.close();
      }
    }
  }
}
