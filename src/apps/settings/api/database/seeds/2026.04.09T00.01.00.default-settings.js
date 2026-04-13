/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Seed default global settings.
 * Uses findOrCreate for idempotency — safe to re-run without duplicates.
 */

import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS = [
  // ── Core & Metadata ───────────────────────────────────────────────────────
  {
    namespace: 'core',
    key: 'APP_NAME',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_PUBLIC_APP_NAME',
    is_public: true,
    description: 'Application display name',
  },
  {
    namespace: 'core',
    key: 'APP_DESCRIPTION',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_PUBLIC_APP_DESC',
    is_public: true,
    description: 'Application description shown in meta tags',
  },
  {
    namespace: 'core',
    key: 'APP_URL',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_PUBLIC_APP_URL',
    is_public: true,
    description: 'Full application URL string',
  },
  {
    namespace: 'core',
    key: 'APP_IMAGE',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_PUBLIC_APP_IMAGE',
    is_public: true,
    description: 'Default Open Graph Social Image URL',
  },
  {
    namespace: 'core',
    key: 'MAINTENANCE_MODE',
    type: 'boolean',
    value: 'false',
    default_env_var: null,
    is_public: true,
    description: 'Enable maintenance mode (blocks non-admin access)',
  },

  // ── Auth & OAuth ──────────────────────────────────────────────────────────
  {
    namespace: 'auth',
    key: 'JWT_EXPIRY',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_JWT_EXPIRY',
    is_public: false,
    description: 'Session JSON Web Token Expiration (e.g. 7d, 2h)',
  },
  {
    namespace: 'auth',
    key: 'ALLOW_REGISTRATION',
    type: 'boolean',
    value: 'true',
    default_env_var: null,
    is_public: true,
    description: 'Allow new user self-registration',
  },
  {
    namespace: 'auth',
    key: 'GOOGLE_CLIENT_ID',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_GOOGLE_CLIENT_ID',
    is_public: true,
    description: 'Google OAuth Client ID',
  },
  {
    namespace: 'auth',
    key: 'GOOGLE_CLIENT_KEY',
    type: 'password',
    value: null,
    default_env_var: 'XNAPIFY_GOOGLE_CLIENT_KEY',
    is_public: false,
    description: 'Google OAuth Client Secret Key',
  },

  // ── Email / SMTP ──────────────────────────────────────────────────────────
  {
    namespace: 'email',
    key: 'MAIL_PROVIDER',
    type: 'string',
    value: 'smtp',
    default_env_var: 'XNAPIFY_MAIL_PROVIDER',
    is_public: false,
    description: 'Mail sending engine (smtp, mailgun, sendgrid, mock)',
  },
  {
    namespace: 'email',
    key: 'FROM_ADDRESS',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_MAIL_FROM',
    is_public: false,
    description: 'Default sender email address',
  },
  {
    namespace: 'email',
    key: 'SMTP_HOST',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_HOST',
    is_public: false,
    description: 'SMTP Server Hostname',
  },
  {
    namespace: 'email',
    key: 'SMTP_PORT',
    type: 'integer',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_PORT',
    is_public: false,
    description: 'SMTP Server Network Port',
  },
  {
    namespace: 'email',
    key: 'SMTP_USER',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_USER',
    is_public: false,
    description: 'SMTP Client Username',
  },
  {
    namespace: 'email',
    key: 'SMTP_KEY',
    type: 'password',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_KEY',
    is_public: false,
    description: 'SMTP Client Security Password',
  },
  {
    namespace: 'email',
    key: 'SMTP_SECURE',
    type: 'boolean',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_SECURE',
    is_public: false,
    description: 'Enable TLS/SSL for SMTP endpoints',
  },

  // ── File & Upload ────────────────────────────────────────────────────────
  {
    namespace: 'file',
    key: 'STORAGE_PROVIDER',
    type: 'string',
    value: 'local',
    default_env_var: 'XNAPIFY_STORAGE_PROVIDER',
    is_public: true,
    description: 'Storage backend provider (e.g., local, s3, gcs)',
  },
  {
    namespace: 'file',
    key: 'MAX_UPLOAD_BYTES',
    type: 'integer',
    value: null,
    default_env_var: 'XNAPIFY_UPLOAD_FILE_SIZE',
    is_public: true,
    description: 'Maximum permitted file upload size globally in Bytes',
  },
  {
    namespace: 'file',
    key: 'ALLOWED_EXTENSIONS',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_UPLOAD_FILE_EXT',
    is_public: true,
    description: 'Comma separated list of allowed file extensions',
  },

  // ── Webhook & Search ─────────────────────────────────────────────────────
  {
    namespace: 'webhook',
    key: 'WEBHOOK_TIMEOUT_MS',
    type: 'integer',
    value: 5000,
    default_env_var: null,
    is_public: false,
    description: 'Timeout for dispatching webhook in milliseconds',
  },
  {
    namespace: 'webhook',
    key: 'MAX_RETRY_ATTEMPTS',
    type: 'integer',
    value: 3,
    default_env_var: null,
    is_public: false,
    description: 'Number of times to retry failed webhook deliveries',
  },
  {
    namespace: 'webhook',
    key: 'REQUIRE_SIGNATURE',
    type: 'boolean',
    value: 'true',
    default_env_var: null,
    is_public: true,
    description: 'Require cryptographic payload signatures for reception',
  },

  // ── Optimization ──────────────────────────────────────────────────────────
  {
    namespace: 'optimization',
    key: 'COMPRESSION',
    type: 'boolean',
    value: null,
    default_env_var: 'XNAPIFY_COMPRESSION',
    is_public: false,
    description: 'Enable native HTTP gzip/brotli compression logic',
  },
  {
    namespace: 'optimization',
    key: 'SSR_CACHE',
    type: 'boolean',
    value: null,
    default_env_var: 'XNAPIFY_SSR_CACHE',
    is_public: false,
    description: 'Enable Server-Side Rendering output caching',
  },
];

export async function up(_, { container }) {
  const { Setting } = container.resolve('models');
  const now = new Date();

  for (const setting of DEFAULT_SETTINGS) {
    await Setting.findOrCreate({
      where: { namespace: setting.namespace, key: setting.key },
      defaults: {
        id: uuidv4(),
        ...setting,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

export async function down(_, { container }) {
  const { Setting } = container.resolve('models');

  for (const setting of DEFAULT_SETTINGS) {
    await Setting.destroy({
      where: { namespace: setting.namespace, key: setting.key },
    });
  }
}
