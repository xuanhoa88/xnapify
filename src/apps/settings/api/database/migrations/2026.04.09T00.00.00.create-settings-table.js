/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the migration — create settings table
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('settings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique setting identifier',
    },
    namespace: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Module or extension grouping',
    },
    key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Config key within namespace',
    },
    type: {
      type: DataTypes.ENUM('string', 'boolean', 'integer', 'json', 'password'),
      defaultValue: 'string',
      allowNull: false,
      comment: 'Value type for admin UI control',
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Serialized value. NULL means use fallback',
    },
    default_env_var: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'process.env key to fallback to',
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'If true, exposed to client via public API',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Human-readable description',
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

  // Unique composite index
  await queryInterface.addIndex('settings', ['namespace', 'key'], {
    unique: true,
    name: 'settings_namespace_key_unique',
  });

  // Lookup indexes
  await queryInterface.addIndex('settings', ['namespace']);
  await queryInterface.addIndex('settings', ['is_public']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('settings');
}
