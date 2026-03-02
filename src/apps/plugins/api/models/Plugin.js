/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Plugin Model Factory
 *
 * Creates the Plugin model with the provided Sequelize instance.
 * Stores plugin metadata and user associations.
 *
 * @param {Object} connection - Sequelize connection instance
 * @param {Object} DataTypes - Sequelize data types
 * @returns {Model} Plugin model
 */
export default function createPluginModel({ connection, DataTypes }) {
  const Plugin = connection.define(
    'Plugin',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique plugin identifier',
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Plugin name',
      },

      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Plugin unique key',
      },

      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Plugin description',
      },

      version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0',
        comment: 'Plugin version',
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether plugin is active globally',
      },

      options: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Plugin configuration options',
      },
    },
    {
      tableName: 'plugins',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  return Plugin;
}
