/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Update group form schema factory
 * Used for editing existing groups
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const updateGroupFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:admin.GROUP_NAME_REQUIRED', 'Group name is required'))
      .max(
        100,
        i18n.t(
          'zod:admin.GROUP_NAME_MAX_LENGTH',
          'Group name must be 100 characters or less',
        ),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.GROUP_DESCRIPTION_MAX_LENGTH',
          'Description must be 500 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    category: z
      .string()
      .max(
        50,
        i18n.t(
          'zod:admin.GROUP_CATEGORY_MAX_LENGTH',
          'Category must be 50 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    type: z
      .string()
      .max(
        50,
        i18n.t(
          'zod:admin.GROUP_TYPE_MAX_LENGTH',
          'Type must be 50 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    roles: z.array(z.string()).optional().default([]),
  });

/**
 * Create group form schema factory
 * Used for creating new groups
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const createGroupFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:admin.GROUP_NAME_REQUIRED', 'Group name is required'))
      .max(
        100,
        i18n.t(
          'zod:admin.GROUP_NAME_MAX_LENGTH',
          'Group name must be 100 characters or less',
        ),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.GROUP_DESCRIPTION_MAX_LENGTH',
          'Description must be 500 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    category: z
      .string()
      .max(
        50,
        i18n.t(
          'zod:admin.GROUP_CATEGORY_MAX_LENGTH',
          'Category must be 50 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    type: z
      .string()
      .max(
        50,
        i18n.t(
          'zod:admin.GROUP_TYPE_MAX_LENGTH',
          'Type must be 50 characters or less',
        ),
      )
      .optional()
      .or(z.literal('')),
    roles: z.array(z.string()).optional().default([]),
  });

/**
 * Assign roles to group schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/admin/groups/:id/roles
 */
export const assignRolesToGroupFormSchema = ({ i18n, z }) =>
  z.object({
    role_names: z.array(z.string(), {
      required_error: i18n.t(
        'zod:admin.group.ROLE_NAMES_REQUIRED',
        'Role names is required',
      ),
      invalid_type_error: i18n.t(
        'zod:admin.group.ROLE_NAMES_INVALID',
        'Role names must be an array',
      ),
    }),
  });
