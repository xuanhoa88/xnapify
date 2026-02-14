/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Plugin form schema - callable factory function
 *
 * Used by:
 * - Backend: POST /api/plugins
 * - Frontend: Plugin creation/update form
 */
export const pluginFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:plugin.name_required', 'Plugin name is required'))
      .max(100, i18n.t('zod:plugin.name_too_long', 'Plugin name is too long'))
      .regex(
        /^[a-z0-9-]+$/,
        i18n.t(
          'zod:plugin.name_invalid',
          'Name must contain only lowercase letters, numbers, and hyphens',
        ),
      ),
    displayName: z
      .string()
      .max(
        100,
        i18n.t('zod:plugin.display_name_too_long', 'Display name is too long'),
      )
      .optional(),
    description: z
      .string()
      .max(
        500,
        i18n.t('zod:plugin.description_too_long', 'Description is too long'),
      )
      .optional(),
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+$/,
        i18n.t(
          'zod:plugin.version_invalid',
          'Version must be in semantic format (x.y.z)',
        ),
      )
      .optional(),
    enabled: z.boolean().optional(),
  });

/**
 * Plugin status schema
 */
export const pluginStatusSchema = ({ i18n, z }) =>
  z.object({
    is_active: z.boolean({
      required_error: i18n.t(
        'zod:plugin.status_required',
        'Status is required',
      ),
    }),
  });
