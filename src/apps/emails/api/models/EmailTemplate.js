/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * EmailTemplate Model Factory
 *
 * Creates the EmailTemplate model with the provided Sequelize instance.
 * Stores managed email templates with LiquidJS body content.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} EmailTemplate model
 */
export default function createEmailTemplateModel({ connection, DataTypes }) {
  const EmailTemplate = connection.define(
    'EmailTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique template identifier',
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        comment: 'Template display name',
      },

      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
        },
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
        defaultValue: {},
        comment: 'Example data for live preview',
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether template is active',
      },
    },
    {
      tableName: 'email_templates',
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
  );

  return EmailTemplate;
}
