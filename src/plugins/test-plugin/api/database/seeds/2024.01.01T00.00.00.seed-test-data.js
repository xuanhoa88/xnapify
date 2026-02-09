export async function up({ context }) {
  const queryInterface = context.getQueryInterface();

  await queryInterface.bulkInsert('test_plugin_table', [
    {
      name: 'Test Plugin Data 1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      name: 'Test Plugin Data 2',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function down({ context }) {
  const queryInterface = context.getQueryInterface();
  await queryInterface.bulkDelete('test_plugin_table', null, {});
}
