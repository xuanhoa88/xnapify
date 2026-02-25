/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

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

/**
 * Plugin upgrade schema
 */
export const pluginUpgradeSchema = ({ i18n: _i18n, z }) =>
  z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      version: z.string().optional(),
    })
    .strict();
