/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Default email-template permissions and role assignments.
 * Registers CRUD actions for the `emails:templates` resource and
 * assigns full permissions to the admin role, read-only to editor/mod.
 */

const EMAILS_PERMISSIONS = {
  emailTemplatesCreate: uuidv4(),
  emailTemplatesRead: uuidv4(),
  emailTemplatesUpdate: uuidv4(),
  emailTemplatesDelete: uuidv4(),
};

export async function up(_, { container }) {
  const { Permission, RolePermission } = container.resolve('models');
  const { DEFAULT_ACTIONS } = container.resolve('auth');
  const SEED_ROLES = container.resolve('roles:seed_constants');

  const RESOURCE = 'emails:templates';

  const permissions = [
    {
      id: EMAILS_PERMISSIONS.emailTemplatesCreate,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.CREATE,
      description:
        'Create email templates for transactional and marketing workflows.',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailTemplatesRead,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.READ,
      description: 'View email template content, metadata, and delivery logs.',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailTemplatesUpdate,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.UPDATE,
      description: 'Modify email template markup, variables, and scheduling.',
      is_active: true,
    },
    {
      id: EMAILS_PERMISSIONS.emailTemplatesDelete,
      resource: RESOURCE,
      action: DEFAULT_ACTIONS.DELETE,
      description: 'Remove email templates from the system.',
      is_active: true,
    },
  ];

  await Permission.bulkCreate(permissions);

  const rolePermissions = [
    // Admin — full CRUD on email templates
    ...Object.values(EMAILS_PERMISSIONS).map(permissionId => ({
      id: uuidv4(),
      role_id: SEED_ROLES.admin,
      permission_id: permissionId,
    })),
    // Editor — read + update (edit templates, no create/delete)
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: EMAILS_PERMISSIONS.emailTemplatesRead,
    },
    {
      id: uuidv4(),
      role_id: SEED_ROLES.editor,
      permission_id: EMAILS_PERMISSIONS.emailTemplatesUpdate,
    },
    // Moderator — read-only (inspect templates for compliance)
    {
      id: uuidv4(),
      role_id: SEED_ROLES.mod,
      permission_id: EMAILS_PERMISSIONS.emailTemplatesRead,
    },
  ];

  await RolePermission.bulkCreate(rolePermissions);
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Permission, RolePermission } = container.resolve('models');

  const RESOURCE = 'emails:templates';

  const permissions = await Permission.findAll({
    where: { resource: RESOURCE },
    attributes: ['id'],
  });

  const permissionIds = permissions.map(p => p.id);

  if (permissionIds.length > 0) {
    await RolePermission.destroy({
      where: { permission_id: permissionIds },
      force: true,
    });

    await Permission.destroy({
      where: { id: permissionIds },
      force: true,
    });
  }
}
