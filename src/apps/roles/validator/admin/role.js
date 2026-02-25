/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Update role form schema factory
 * Used for editing existing roles
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const updateRoleFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:admin.ROLE_NAME_REQUIRED', 'Role name is required'))
      .max(
        100,
        i18n.t(
          'zod:admin.ROLE_NAME_MAX_LENGTH',
          'Role name must be 100 characters or less',
        ),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.ROLE_DESCRIPTION_MAX_LENGTH',
          'Description must be 500 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    permissions: z.array(z.string()).optional().default([]),
  });

/**
 * Create role form schema factory
 * Used for creating new roles
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const createRoleFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:admin.ROLE_NAME_REQUIRED', 'Role name is required'))
      .max(
        100,
        i18n.t(
          'zod:admin.ROLE_NAME_MAX_LENGTH',
          'Role name must be 100 characters or less',
        ),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.ROLE_DESCRIPTION_MAX_LENGTH',
          'Description must be 500 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    permissions: z.array(z.string()).optional().default([]),
  });

/**
 * Manage role permissions schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/admin/roles/:id/permissions
 */
export const manageRolePermissionsFormSchema = ({ i18n, z }) =>
  z.object({
    action: z.enum(['add', 'remove', 'replace'], {
      errorMap: () => ({
        message: i18n.t(
          'zod:admin.role.ACTION_INVALID',
          'Action must be add, remove, or replace',
        ),
      }),
    }),
    permissions: z.array(z.string(), {
      required_error: i18n.t(
        'zod:admin.role.PERMISSIONS_REQUIRED',
        'Permissions is required',
      ),
      invalid_type_error: i18n.t(
        'zod:admin.role.PERMISSIONS_INVALID',
        'Permissions must be an array of "resource:action" strings',
      ),
    }),
  });

/**
 * Assign roles to user schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/users/:id/roles
 */
export const assignRolesToUserFormSchema = ({ i18n, z }) =>
  z.object({
    role_names: z.array(z.string(), {
      required_error: i18n.t(
        'zod:admin.user.ROLE_NAMES_REQUIRED',
        'Role names is required',
      ),
      invalid_type_error: i18n.t(
        'zod:admin.user.ROLE_NAMES_INVALID',
        'Role names must be an array',
      ),
    }),
  });

/**
 * Assign groups to user schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/users/:id/groups
 */
export const assignGroupsToUserFormSchema = ({ i18n, z }) =>
  z.object({
    group_ids: z.array(z.string().uuid(), {
      required_error: i18n.t(
        'zod:admin.user.GROUP_IDS_REQUIRED',
        'Group IDs is required',
      ),
      invalid_type_error: i18n.t(
        'zod:admin.user.GROUP_IDS_INVALID',
        'Group IDs must be an array',
      ),
    }),
  });
