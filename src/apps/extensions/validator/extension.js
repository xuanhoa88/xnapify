/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Extension status schema
 */
export const extensionStatusSchema = ({ i18n, z }) =>
  z.object({
    is_active: z.boolean({
      required_error: i18n.t(
        'zod:extension.status_required',
        'Status is required',
      ),
    }),
  });
