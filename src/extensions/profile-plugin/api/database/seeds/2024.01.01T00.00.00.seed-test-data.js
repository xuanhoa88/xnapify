/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export async function up({ context }) {
  const queryInterface = context.getQueryInterface();

  await queryInterface.bulkInsert('test_extension_table', [
    {
      name: 'Test Extension Data 1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      name: 'Test Extension Data 2',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function down({ context }) {
  const queryInterface = context.getQueryInterface();
  await queryInterface.bulkDelete('test_extension_table', null, {});
}
