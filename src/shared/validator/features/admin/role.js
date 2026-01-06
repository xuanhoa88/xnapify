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
