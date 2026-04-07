/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { MailgunEmailProvider } from '../providers/mailgun';
import { MemoryEmailProvider } from '../providers/memory';
import { ResendEmailProvider } from '../providers/resend';
import { SendGridEmailProvider } from '../providers/sendgrid';
import { SmtpEmailProvider } from '../providers/smtp';
import { EmailError } from './errors';

/**
 * Common logic to instantiate a provider based on its name and options.
 * This is used by both the EmailManager lazy initialization and the
 * worker logic to prevent DRY violations.
 *
 * Falls back to process.env for standard providers if values are missing.
 *
 * @param {string} providerType - The name of the provider (e.g., 'smtp', 'memory')
 * @param {Object} options - Configuration overrides that take precedence over process.env
 * @returns {Object} The provider instance
 */
export function createProviderByName(providerType = 'memory', options = {}) {
  switch (providerType) {
    case 'memory':
      return new MemoryEmailProvider(options);

    case 'smtp':
      return new SmtpEmailProvider({
        host: process.env.XNAPIFY_SMTP_HOST,
        port: parseInt(process.env.XNAPIFY_SMTP_PORT, 10) || 587,
        secure: process.env.XNAPIFY_SMTP_SECURE === 'true',
        user: process.env.XNAPIFY_SMTP_USER,
        pass: process.env.XNAPIFY_SMTP_KEY,
        defaultFrom: process.env.XNAPIFY_MAIL_FROM,
        defaultFromName:
          process.env.XNAPIFY_MAIL_FROM_NAME ||
          process.env.XNAPIFY_PUBLIC_APP_NAME,
        ...options,
      });

    case 'sendgrid':
      return new SendGridEmailProvider({
        apiKey: process.env.XNAPIFY_SENDGRID_KEY,
        defaultFrom: process.env.XNAPIFY_MAIL_FROM,
        defaultFromName:
          process.env.XNAPIFY_MAIL_FROM_NAME ||
          process.env.XNAPIFY_PUBLIC_APP_NAME,
        ...options,
      });

    case 'mailgun':
      return new MailgunEmailProvider({
        apiKey: process.env.XNAPIFY_MAILGUN_KEY,
        domain: process.env.XNAPIFY_MAILGUN_DOMAIN,
        region: process.env.XNAPIFY_MAILGUN_REGION || 'us',
        defaultFrom: process.env.XNAPIFY_MAIL_FROM,
        defaultFromName:
          process.env.XNAPIFY_MAIL_FROM_NAME ||
          process.env.XNAPIFY_PUBLIC_APP_NAME,
        ...options,
      });

    case 'resend':
      return new ResendEmailProvider({
        apiKey: process.env.XNAPIFY_RESEND_KEY,
        defaultFrom: process.env.XNAPIFY_MAIL_FROM,
        defaultFromName:
          process.env.XNAPIFY_MAIL_FROM_NAME ||
          process.env.XNAPIFY_PUBLIC_APP_NAME,
        ...options,
      });

    default:
      throw new EmailError(
        `Unknown provider type: ${providerType}`,
        'INVALID_PROVIDER',
        400,
      );
  }
}
