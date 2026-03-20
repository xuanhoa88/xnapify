/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Send Email Worker - Handles email sending operations
 * Supports both same-process and child process execution
 */

import { MailgunEmailProvider } from '../providers/mailgun';
import { MemoryEmailProvider } from '../providers/memory';
import { ResendEmailProvider } from '../providers/resend';
import { SendGridEmailProvider } from '../providers/sendgrid';
import { SmtpEmailProvider } from '../providers/smtp';
import { EMAIL_VALIDATED } from '../utils/constants';
import { EmailError } from '../utils/errors';
import { processEmails } from '../utils/processing';
import { validateEmails } from '../utils/validation';

/**
 * Provider cache for same-process workers
 * Reuses provider instances to avoid connection overhead
 */
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 50;

const providerCache = new Map();
const cacheTimestamps = new Map();

/**
 * Generate cache key for provider configuration
 * @param {Object} options - Provider options
 * @returns {string} Cache key
 */
function getProviderCacheKey(options = {}) {
  const providerType = options.provider || 'memory';
  const config = options[providerType] || {};
  return `${providerType}_${JSON.stringify(config)}`;
}

/**
 * Create or retrieve cached email provider
 * @param {Object} options - Provider options
 * @returns {Object} Provider instance
 */
function getCachedProvider(options = {}) {
  const cacheKey = getProviderCacheKey(options);
  const now = Date.now();

  // Check if cached and not expired
  if (providerCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return providerCache.get(cacheKey);
    }
    // Expired - remove from cache
    providerCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
  }

  // Proactively sweep expired entries to prevent memory accumulation
  if (providerCache.size >= MAX_CACHE_SIZE) {
    for (const [key, ts] of cacheTimestamps) {
      if (now - ts >= CACHE_TTL) {
        providerCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
  }

  // Evict oldest entry if cache is still full after sweep
  if (providerCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cacheTimestamps.keys().next().value;
    providerCache.delete(oldestKey);
    cacheTimestamps.delete(oldestKey);
  }

  // Create and cache new provider
  const provider = createProvider(options);
  providerCache.set(cacheKey, provider);
  cacheTimestamps.set(cacheKey, now);
  return provider;
}

/**
 * Create email provider based on configuration
 * Falls back to process.env for provider config (same as factory.js)
 * @param {Object} options - Provider options
 * @returns {Object} Provider instance
 */
function createProvider(options = {}) {
  const providerType = options.provider || 'memory';
  const explicitConfig = options[providerType] || {};

  switch (providerType) {
    case 'memory':
      return new MemoryEmailProvider(explicitConfig);

    case 'smtp':
      return new SmtpEmailProvider({
        host: process.env.RSK_SMTP_HOST,
        port: parseInt(process.env.RSK_SMTP_PORT, 10) || 587,
        secure: process.env.RSK_SMTP_SECURE === 'true',
        user: process.env.RSK_SMTP_USER,
        pass: process.env.RSK_SMTP_PASS,
        defaultFrom: process.env.RSK_MAIL_FROM,
        defaultFromName:
          process.env.RSK_MAIL_FROM_NAME || process.env.RSK_APP_NAME,
        ...explicitConfig,
      });

    case 'sendgrid':
      return new SendGridEmailProvider({
        apiKey: process.env.RSK_SENDGRID_KEY,
        defaultFrom: process.env.RSK_MAIL_FROM,
        defaultFromName:
          process.env.RSK_MAIL_FROM_NAME || process.env.RSK_APP_NAME,
        ...explicitConfig,
      });

    case 'mailgun':
      return new MailgunEmailProvider({
        apiKey: process.env.RSK_MAILGUN_KEY,
        domain: process.env.RSK_MAILGUN_DOMAIN,
        region: process.env.RSK_MAILGUN_REGION,
        defaultFrom: process.env.RSK_MAIL_FROM,
        defaultFromName:
          process.env.RSK_MAIL_FROM_NAME || process.env.RSK_APP_NAME,
        ...explicitConfig,
      });

    case 'resend':
      return new ResendEmailProvider({
        apiKey: process.env.RSK_RESEND_KEY,
        defaultFrom: process.env.RSK_MAIL_FROM,
        defaultFromName:
          process.env.RSK_MAIL_FROM_NAME || process.env.RSK_APP_NAME,
        ...explicitConfig,
      });

    default:
      throw new EmailError(
        `Unknown provider type: ${providerType}`,
        'INVALID_PROVIDER',
        400,
      );
  }
}

/**
 * Process email send operations
 * @param {Object} data - Send data
 * @returns {Promise<Object>} Send result
 */
async function processSend(data) {
  const { emails, options = {} } = data;

  // Validate only if not already validated by service
  // (defense in depth for forked workers, avoid double validation for same-process)
  if (!options[EMAIL_VALIDATED]) {
    const validationResult = validateEmails(emails);
    if (!validationResult.success) {
      throw new EmailError(
        JSON.stringify(validationResult.error.flatten()),
        'VALIDATION_ERROR',
        400,
      );
    }
  }

  // Get cached provider instance (or create if first time)
  const provider = getCachedProvider(options);

  return processEmails(provider, emails, options);
}

// Create worker function using helper

export { processSend as SEND_EMAIL };
export default processSend;
