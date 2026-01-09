/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Constants and Configuration
 */

// Rate limiting and batch sizes
export const EMAIL_LIMITS = Object.freeze({
  MAX_RECIPIENTS: 50, // Max recipients per email
  MAX_BATCH_SIZE: 100, // Max emails per batch
  DEFAULT_BATCH_SIZE: 25, // Default batch processing size
  MAX_ATTACHMENTS: 10, // Max attachments per email
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB per attachment
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB body size
  RATE_LIMIT_PER_MINUTE: 60, // Default rate limit
  RATE_LIMIT_PER_HOUR: 1000, // Hourly rate limit
});

// Default configuration from environment variables
export const DEFAULT_PROVIDER =
  process.env.RSK_EMAIL_DEFAULT_PROVIDER || 'smtp';

export const SMTP_CONFIG = Object.freeze({
  host: process.env.RSK_EMAIL_SMTP_HOST || 'localhost',
  port: parseInt(process.env.RSK_EMAIL_SMTP_PORT, 10) || 587,
  secure: process.env.RSK_EMAIL_SMTP_SECURE === 'true',
  user: process.env.RSK_EMAIL_SMTP_USER || '',
  pass: process.env.RSK_EMAIL_SMTP_PASS || '',
});

export const SENDGRID_CONFIG = Object.freeze({
  apiKey: process.env.RSK_EMAIL_SENDGRID_API_KEY || '',
});

export const MAILGUN_CONFIG = Object.freeze({
  apiKey: process.env.RSK_EMAIL_MAILGUN_API_KEY || '',
  domain: process.env.RSK_EMAIL_MAILGUN_DOMAIN || '',
});

// Default sender configuration
export const DEFAULT_FROM =
  process.env.RSK_EMAIL_DEFAULT_FROM || 'noreply@example.com';
export const DEFAULT_FROM_NAME =
  process.env.RSK_EMAIL_DEFAULT_FROM_NAME || 'System';

// Error codes
export const ERROR_CODES = Object.freeze({
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  INVALID_TEMPLATE: 'INVALID_TEMPLATE',
  SEND_FAILED: 'SEND_FAILED',
  BATCH_SEND_FAILED: 'BATCH_SEND_FAILED',
  TEMPLATE_RENDER_FAILED: 'TEMPLATE_RENDER_FAILED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  ATTACHMENT_TOO_LARGE: 'ATTACHMENT_TOO_LARGE',
  INVALID_INPUT: 'INVALID_INPUT',
  WORKER_ERROR: 'WORKER_ERROR',
});

// Email priority levels
export const PRIORITY = Object.freeze({
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
});

// Worker configuration
export const WORKER_CONFIG = Object.freeze({
  maxWorkers: parseInt(process.env.RSK_EMAIL_MAX_WORKERS, 10) || 4,
  workerTimeout: parseInt(process.env.RSK_EMAIL_WORKER_TIMEOUT, 10) || 60000,
  maxRequestsPerWorker:
    parseInt(process.env.RSK_EMAIL_MAX_REQUESTS_PER_WORKER, 10) || 100,
});
