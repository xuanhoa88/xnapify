/**
 * Seed: Default App Settings
 *
 * This seed creates default application settings.
 */

/**
 * Run the seed
 */
export async function up({ context }) {
  const { queryInterface } = context;

  const now = new Date();

  const settings = [
    // Site settings
    {
      key: 'site.name',
      value: 'React Starter Kit',
      type: 'string',
      category: 'site',
      description: 'Application name',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'site.description',
      value: 'A modern React starter kit with best practices',
      type: 'string',
      category: 'site',
      description: 'Application description',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'site.url',
      value: 'http://localhost:3000',
      type: 'string',
      category: 'site',
      description: 'Base URL of the application',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'site.logo',
      value: '/logo.png',
      type: 'string',
      category: 'site',
      description: 'Path to site logo',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },

    // Email settings
    {
      key: 'email.from.name',
      value: 'React Starter Kit',
      type: 'string',
      category: 'email',
      description: 'Default sender name for emails',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'email.from.address',
      value: 'noreply@example.com',
      type: 'string',
      category: 'email',
      description: 'Default sender email address',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },

    // Security settings
    {
      key: 'security.session.timeout',
      value: '3600',
      type: 'number',
      category: 'security',
      description: 'Session timeout in seconds',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'security.password.minLength',
      value: '8',
      type: 'number',
      category: 'security',
      description: 'Minimum password length',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'security.password.requireSpecialChar',
      value: 'true',
      type: 'boolean',
      category: 'security',
      description: 'Require special characters in passwords',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'security.maxLoginAttempts',
      value: '5',
      type: 'number',
      category: 'security',
      description: 'Maximum failed login attempts before account lock',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },

    // Feature flags
    {
      key: 'features.registration.enabled',
      value: 'true',
      type: 'boolean',
      category: 'features',
      description: 'Enable user registration',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'features.oauth.enabled',
      value: 'true',
      type: 'boolean',
      category: 'features',
      description: 'Enable OAuth authentication',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'features.notifications.enabled',
      value: 'true',
      type: 'boolean',
      category: 'features',
      description: 'Enable notifications system',
      is_public: true,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },

    // API settings
    {
      key: 'api.rateLimit.enabled',
      value: 'true',
      type: 'boolean',
      category: 'api',
      description: 'Enable API rate limiting',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'api.rateLimit.maxRequests',
      value: '100',
      type: 'number',
      category: 'api',
      description: 'Maximum requests per window',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
    {
      key: 'api.rateLimit.windowMs',
      value: '900000',
      type: 'number',
      category: 'api',
      description: 'Rate limit window in milliseconds (15 minutes)',
      is_public: false,
      is_editable: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('app_settings', settings);
}

/**
 * Revert the seed
 */
export async function down({ context }) {
  const { queryInterface } = context;

  // Remove all seeded settings
  await queryInterface.bulkDelete('app_settings', {
    category: ['site', 'email', 'security', 'features', 'api'],
  });
}
