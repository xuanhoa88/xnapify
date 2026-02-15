/**
 * Seed: Add Node-RED Permission
 *
 * Adds the 'nodered:admin' permission and assigns it to the 'admin' role.
 */

import { v4 as uuidv4 } from 'uuid';

export async function up({ context }) {
  const { queryInterface } = context;

  // 1. Check if permission already exists
  const existingPermissions = await queryInterface.sequelize.query(
    "SELECT id FROM permissions WHERE resource = 'nodered' AND action = 'admin'",
    { type: queryInterface.sequelize.QueryTypes.SELECT },
  );

  let permissionId = existingPermissions[0]?.id;

  if (!permissionId) {
    // Insert 'nodered:admin' permission
    permissionId = uuidv4();
    await queryInterface.bulkInsert('permissions', [
      {
        id: permissionId,
        resource: 'nodered',
        action: 'admin',
        description: 'Access to Node-RED admin interface',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }

  // 2. Get admin role ID
  const roles = await queryInterface.sequelize.query(
    "SELECT id FROM roles WHERE name = 'admin'",
    { type: queryInterface.sequelize.QueryTypes.SELECT },
  );

  const roleId = roles[0]?.id;

  if (roleId && permissionId) {
    // 3. Check if assignment already exists
    const existingAssignment = await queryInterface.sequelize.query(
      `SELECT id FROM role_permissions WHERE role_id = '${roleId}' AND permission_id = '${permissionId}'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    if (existingAssignment.length === 0) {
      // 4. Assign permission to admin role
      // MUST generate ID for bulkInsert as it bypasses model defaults
      await queryInterface.bulkInsert('role_permissions', [
        {
          id: uuidv4(),
          role_id: roleId,
          permission_id: permissionId,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    } else {
      console.log('ℹ️  Permission already assigned to admin role');
    }
  } else {
    console.warn('⚠️ Admin role not found - skipping permission assignment');
  }
}

export async function down({ context }) {
  const { queryInterface } = context;

  // 1. Get permission ID
  const permissions = await queryInterface.sequelize.query(
    "SELECT id FROM permissions WHERE resource = 'nodered' AND action = 'admin'",
    { type: queryInterface.sequelize.QueryTypes.SELECT },
  );

  const permissionId = permissions[0]?.id;

  if (permissionId) {
    // 2. Remove from role_permissions
    await queryInterface.bulkDelete('role_permissions', {
      permission_id: permissionId,
    });

    // 3. Remove permission
    await queryInterface.bulkDelete('permissions', {
      id: permissionId,
    });
  }
}
