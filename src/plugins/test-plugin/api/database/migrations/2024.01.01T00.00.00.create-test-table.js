export async function up({ context, Sequelize }) {
  const { DataTypes } = Sequelize;
  const queryInterface = context.getQueryInterface();

  await queryInterface.createTable('test_plugin_table', {
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
  await queryInterface.dropTable('test_plugin_table');
}
