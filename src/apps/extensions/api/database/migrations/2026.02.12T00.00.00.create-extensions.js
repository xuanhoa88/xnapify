/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Run the migration
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.createTable('extensions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'Unique extension identifier',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Extension name',
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Extension unique key',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Extension description',
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '0.0.0',
      comment: 'Extension version',
    },
    integrity: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      comment: 'SHA-256 integrity hash of built extension files',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether extension is active globally',
    },
    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'plugin',
      comment: 'Extension type: plugin or module',
    },
    options: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Extension configuration options',
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
  await queryInterface.addIndex('extensions', ['name'], { unique: true });
  await queryInterface.addIndex('extensions', ['key'], { unique: true });
  await queryInterface.addIndex('extensions', ['is_active']);
  await queryInterface.addIndex('extensions', ['type']);
}

/**
 * Revert the migration
 */
export async function down({ context }) {
  const { queryInterface } = context;
  await queryInterface.dropTable('extensions');
}
