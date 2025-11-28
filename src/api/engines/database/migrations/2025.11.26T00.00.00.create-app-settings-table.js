/**
 * Migration: Create App Settings Table
 *
 * This migration creates the app_settings table for storing
 * application-wide configuration and settings.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('app_settings', {
    key: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      comment: 'Setting key (e.g., site.name, site.description)',
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Setting value (can be JSON string for complex values)',
    },
    type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'array'),
      defaultValue: 'string',
      allowNull: false,
      comment: 'Data type of the value',
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Setting category (e.g., site, email, security)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of what this setting controls',
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this setting can be exposed to the client',
    },
    is_editable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether this setting can be edited via UI',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  // Add indexes for better query performance
  await queryInterface.addIndex('app_settings', ['key'], { unique: true });
  await queryInterface.addIndex('app_settings', ['category']);
  await queryInterface.addIndex('app_settings', ['is_public']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('app_settings');
}
