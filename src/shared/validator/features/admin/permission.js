/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Update permission schema - callable factory function
 *
 * Used by:
 * - Frontend: Edit permission form in admin panel
 * - Backend: PUT /api/admin/permissions/:id
 */
export const updatePermissionFormSchema = ({ i18n, z }) =>
  z.object({
    resource: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.permission.RESOURCE_REQUIRED',
          'Resource is required',
        ),
      )
      .max(
        100,
        i18n.t('zod:admin.permission.RESOURCE_MAX', 'Resource is too long'),
      ),
    action: z
      .string()
      .min(
        1,
        i18n.t('zod:admin.permission.ACTION_REQUIRED', 'Action is required'),
      )
      .max(
        100,
        i18n.t('zod:admin.permission.ACTION_MAX', 'Action is too long'),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.permission.DESCRIPTION_MAX',
          'Description is too long',
        ),
      )
      .optional(),
    is_active: z.boolean(),
  });

/**
 * Create permission schema - callable factory function
 *
 * Used by:
 * - Frontend: Create permission form in admin panel
 * - Backend: POST /api/admin/permissions
 */
export const createPermissionFormSchema = ({ i18n, z }) =>
  z.object({
    resource: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.permission.RESOURCE_REQUIRED',
          'Resource is required',
        ),
      )
      .max(
        100,
        i18n.t('zod:admin.permission.RESOURCE_MAX', 'Resource is too long'),
      ),
    action: z
      .string()
      .min(
        1,
        i18n.t('zod:admin.permission.ACTION_REQUIRED', 'Action is required'),
      )
      .max(
        100,
        i18n.t('zod:admin.permission.ACTION_MAX', 'Action is too long'),
      ),
    description: z
      .string()
      .max(
        500,
        i18n.t(
          'zod:admin.permission.DESCRIPTION_MAX',
          'Description is too long',
        ),
      )
      .optional(),
    is_active: z.boolean(),
  });
