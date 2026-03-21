/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export async function up({ context, Sequelize }) {
  const { DataTypes } = Sequelize;
  const queryInterface = context.getQueryInterface();

  await queryInterface.createTable('test_extension_table', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });
}

export async function down({ context }) {
  const queryInterface = context.getQueryInterface();
  await queryInterface.dropTable('test_extension_table');
}
