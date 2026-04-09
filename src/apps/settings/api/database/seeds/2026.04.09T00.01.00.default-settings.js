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
  // ── Core ──────────────────────────────────────────────────────────────────
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
    key: 'MAINTENANCE_MODE',
    type: 'boolean',
    value: 'false',
    default_env_var: null,
    is_public: true,
    description: 'Enable maintenance mode (blocks non-admin access)',
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    namespace: 'auth',
    key: 'SESSION_TTL',
    type: 'integer',
    value: null,
    default_env_var: 'XNAPIFY_SESSION_TTL',
    is_public: false,
    description: 'Session TTL in seconds (default: 3600)',
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

  // ── Email ─────────────────────────────────────────────────────────────────
  {
    namespace: 'email',
    key: 'FROM_ADDRESS',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_FROM',
    is_public: false,
    description: 'Default sender email address',
  },
  {
    namespace: 'email',
    key: 'FROM_NAME',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_SMTP_FROM_NAME',
    is_public: false,
    description: 'Default sender display name',
  },

  // ── File ─────────────────────────────────────────────────────────────────
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
    key: 'MAX_UPLOAD_SIZE_MB',
    type: 'integer',
    value: 50,
    default_env_var: 'XNAPIFY_MAX_UPLOAD_SIZE',
    is_public: true,
    description: 'Maximum permitted file upload size in MB',
  },
  {
    namespace: 'file',
    key: 'ALLOWED_EXTENSIONS',
    type: 'string',
    value: '.jpg,.png,.pdf,.docx',
    default_env_var: null,
    is_public: true,
    description: 'Comma separated list of allowed file extensions',
  },

  // ── Webhook ──────────────────────────────────────────────────────────────
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
    description:
      'Require cryptographic payload signatures for webhook reception',
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
