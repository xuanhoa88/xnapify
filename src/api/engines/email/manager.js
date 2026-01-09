/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '../../../shared/validator';
import { SmtpEmailProvider } from './providers/smtp';
import { SendGridEmailProvider } from './providers/sendgrid';
import { MailgunEmailProvider } from './providers/mailgun';
import { MemoryEmailProvider } from './providers/memory';
import {
  EmailError,
  createResponse,
  processEmails,
  sendEmailsFormSchema,
} from './utils';
import workerService from './workers';

/**
 * Decision logic for whether to use background worker
 * @private
 * @param {Array} emails - Array of email objects
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
function makeSendDecision(emails, options = {}) {
  const thresholds = {
    batchThreshold: options.batchThreshold || 5,
    largeBodyThreshold: options.largeBodyThreshold || 100 * 1024, // 100KB
  };

  let useWorker = false;
  let reason = 'Simple email(s), main process sufficient';

  // Check if this is a batch operation
  if (emails.length >= thresholds.batchThreshold) {
    useWorker = true;
    reason = `Batch send (${emails.length} emails)`;
  }
  // Check for large email content in any email
  else if (
    emails.some(
      email =>
        (email.html && email.html.length >= thresholds.largeBodyThreshold) ||
        (email.text && email.text.length >= thresholds.largeBodyThreshold),
    )
  ) {
    useWorker = true;
    reason = 'Large email body';
  }
  // Check for attachments in any email
  else if (
    emails.some(email => email.attachments && email.attachments.length > 0)
  ) {
    useWorker = true;
    reason = 'Has attachment(s)';
  }

  return { useWorker, reason };
}

/**
 * Email Manager
 *
 * Manages multiple email providers and provides a unified send interface.
 * Handles validation, worker decisions, and response formatting.
 */
class EmailManager {
  constructor(config = {}) {
    this.providers = new Map();
    this.defaultProvider = 'smtp';
    this.config = config;

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
      process.env.RSK_EMAIL_SMTP_HOST ||
      this.defaultProvider === 'smtp'
    ) {
      this.providers.set(
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
      this.providers.set(
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
      this.providers.set(
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
   * Send email(s)
   * Handles single email, bulk emails, and templates.
   * Automatically offloads to worker for large/batch operations.
   *
   * @param {Object|Array} emails - Single email object or array of emails
   * @param {Object} options - Send options
   * @param {string} [options.provider] - Specific provider to use
   * @param {boolean} [options.useWorker] - Override worker decision
   * @returns {Promise<Object>} Send result
   *
   * @example
   * // Single email
   * await email.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
   *
   * // With template placeholders
   * await email.send({
   *   to: 'user@example.com',
   *   subject: 'Hi {{name}}',
   *   html: '<p>Hello {{name}}</p>',
   *   templateData: { name: 'John' }
   * });
   *
   * // Bulk emails
   * await email.send([
   *   { to: 'user1@example.com', subject: 'Hi', html: '<p>Hello 1</p>' },
   *   { to: 'user2@example.com', subject: 'Hi', html: '<p>Hello 2</p>' }
   * ]);
   */
  async send(emails, options = {}) {
    try {
      // Normalize to array
      const emailList = Array.isArray(emails) ? emails : [emails];

      if (emailList.length === 0) {
        throw new EmailError(
          'At least one email is required',
          'INVALID_INPUT',
          400,
        );
      }

      // Validate using Zod schema
      const [isValid, validationErrors] = validateForm(
        sendEmailsFormSchema,
        emailList,
      );
      if (!isValid) {
        return createResponse(
          false,
          null,
          'Validation failed',
          new EmailError(
            JSON.stringify(validationErrors),
            'VALIDATION_ERROR',
            400,
          ),
        );
      }

      // Use hybrid decision service to determine processing method
      const decision = makeSendDecision(emailList, options);

      // Use worker if decision says so OR if useWorker is explicitly set
      if (decision.useWorker || options.useWorker) {
        return workerService.processSend(emailList, {
          ...options,
          forceFork: options.useWorker,
        });
      }

      // Process directly
      return processEmails(emailList, options);
    } catch (error) {
      if (error instanceof EmailError) {
        return createResponse(false, null, error.message, error);
      }
      return createResponse(
        false,
        null,
        'Failed to send email',
        new EmailError(error.message, 'SEND_FAILED', 500),
      );
    }
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

/**
 * Singleton instance of EmailManager
 * Used by the application via app.get('email')
 */
const emailFactory = new EmailManager();

/**
 * Create a new isolated EmailManager instance
 * Useful for testing or isolated email contexts
 *
 * @param {Object} config - Email manager configuration
 * @returns {EmailManager} New manager instance
 */
export function createFactory(config = {}) {
  return new EmailManager(config);
}

export default emailFactory;
