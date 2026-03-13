/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Stable UUIDs for emails permissions (used as seed constants)
const EMAILS_PERMISSIONS = {
  emailsTemplatesCreate: uuidv4(),
  emailsTemplatesRead: uuidv4(),
  emailsTemplatesUpdate: uuidv4(),
  emailsTemplatesDelete: uuidv4(),
};

/**
 * Run the seed
 */
export async function up(_, { app }) {
  const { Permission, RolePermission } = app.get('models');

  // Get default resources and actions from auth
  const { DEFAULT_ACTIONS } = app.get('auth');

  // Get seed roles from container
  const container = app.get('container');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  // Register the emails:templates resource
  const RESOURCE = 'emails:templates';

  // Only seed if the resource doesn't already exist
  const existingCount = await Permission.count({
    where: { resource: RESOURCE },
  });
  if (existingCount > 0) return;

  const permissions = [
    {
      id: EMAILS_PERMISSIONS.emailsTemplatesCreate,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.CREATE,
      description: 'Create email templates',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailsTemplatesRead,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.READ,
      description: 'View email templates',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailsTemplatesUpdate,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Update email templates',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailsTemplatesDelete,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Delete email templates',
      is_active: true,
    },
  ];

  await Permission.bulkCreate(permissions);

  // Assign all emails permissions to admin role
  const rolePermissions = Object.values(EMAILS_PERMISSIONS).map(
    permissionId => ({
      id: uuidv4(),
      role_id: SEED_ROLES.admin,
      permission_id: permissionId,
    }),
  );

  await RolePermission.bulkCreate(rolePermissions);
}

/**
 * Revert the seed
 */
export async function down(_, { app }) {
  const { Permission, RolePermission } = app.get('models');

  const RESOURCE = 'emails:templates';

  // Find all permissions for this resource
  const permissions = await Permission.findAll({
    where: { resource: RESOURCE },
    attributes: ['id'],
  });

  const permissionIds = permissions.map(p => p.id);

  if (permissionIds.length > 0) {
    // Remove role-permission links
    await RolePermission.destroy({
      where: { permission_id: permissionIds },
      force: true,
    });

    // Remove the permissions themselves
    await Permission.destroy({
      where: { id: permissionIds },
      force: true,
    });
  }
}
