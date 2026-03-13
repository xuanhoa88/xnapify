/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the migration — create email_templates table
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('email_templates', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique template identifier',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Template display name',
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'URL-friendly unique key',
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'LiquidJS subject line template',
    },
    html_body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'LiquidJS HTML body template',
    },
    text_body: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional plain-text body fallback',
    },
    sample_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Example data for live preview',
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether template is active',
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp',
    },
  });

  // Add indexes
  await queryInterface.addIndex('email_templates', ['slug'], { unique: true });
  await queryInterface.addIndex('email_templates', ['name']);
  await queryInterface.addIndex('email_templates', ['is_active']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('email_templates');
}
