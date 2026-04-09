/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Setting Model Factory
 *
 * Creates the Setting model with the provided Sequelize instance.
 * Stores global configuration key-value pairs grouped by namespace,
 * with optional process.env fallback and type metadata.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} Setting model
 */
export default function createSettingModel({ connection, DataTypes }) {
  const Setting = connection.define(
    'Setting',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique setting identifier',
      },

      namespace: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          is: /^[a-z0-9_-]+$/i,
        },
        comment: 'Module or extension grouping (e.g. core, auth, emails)',
      },

      key: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        comment: 'Config key within namespace (e.g. SESSION_TTL)',
      },

      type: {
        type: DataTypes.ENUM(
          'string',
          'boolean',
          'integer',
          'json',
          'password',
        ),
        defaultValue: 'string',
        allowNull: false,
        comment: 'Value type — determines admin UI control and coercion',
      },

      value: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Serialized value. NULL means "use fallback"',
      },

      default_env_var: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment:
          'process.env key to fallback to when value is NULL (e.g. XNAPIFY_PUBLIC_APP_NAME)',
      },

      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'If true, exposed to client via public API endpoint',
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Human-readable description for the admin UI',
      },
    },
    {
      tableName: 'settings',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['namespace', 'key'],
          name: 'settings_namespace_key_unique',
        },
      ],
    },
  );

  return Setting;
}
