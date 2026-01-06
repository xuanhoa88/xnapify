/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { strongPasswordRule } from '../auth/common';

/**
 * Update user schema - callable factory function
 *
 * Used by:
 * - Frontend: Edit user form in admin panel
 * - Backend: PUT /api/admin/users/:id
 */
export const updateUserFormSchema = ({ i18n, z }) =>
  z.object({
    display_name: z
      .string()
      .max(
        100,
        i18n.t('zod:admin.user.DISPLAY_NAME_MAX', 'Display name is too long'),
      )
      .optional(),
    first_name: z
      .string()
      .max(
        50,
        i18n.t('zod:admin.user.FIRST_NAME_MAX', 'First name is too long'),
      )
      .optional(),
    last_name: z
      .string()
      .max(50, i18n.t('zod:admin.user.LAST_NAME_MAX', 'Last name is too long'))
      .optional(),
    password: z
      .union([
        z.literal(''), // Allow empty string for no password change
        strongPasswordRule({ i18n, z }),
      ])
      .optional(),
    roles: z
      .array(z.string())
      .min(
        1,
        i18n.t(
          'zod:admin.user.ROLES_REQUIRED',
          'At least one role is required',
        ),
      ),
    groups: z.array(z.string()).optional(),
    is_active: z.boolean(),
  });

/**
 * Create user schema - callable factory function
 *
 * Used by:
 * - Frontend: Create user form in admin panel
 * - Backend: POST /api/admin/users
 */
export const createUserFormSchema = ({ i18n, z }) =>
  z
    .object({
      email: z
        .string()
        .min(1, i18n.t('zod:auth.EMAIL_REQUIRED', 'Email is required'))
        .email(i18n.t('zod:auth.EMAIL_INVALID', 'Email is invalid')),
      password: strongPasswordRule({ i18n, z }),
      confirm_password: z.string(),
      display_name: z
        .string()
        .max(
          100,
          i18n.t('zod:admin.user.DISPLAY_NAME_MAX', 'Display name is too long'),
        )
        .optional(),
      first_name: z
        .string()
        .max(
          50,
          i18n.t('zod:admin.user.FIRST_NAME_MAX', 'First name is too long'),
        )
        .optional(),
      last_name: z
        .string()
        .max(
          50,
          i18n.t('zod:admin.user.LAST_NAME_MAX', 'Last name is too long'),
        )
        .optional(),
      roles: z
        .array(z.string())
        .min(
          1,
          i18n.t(
            'zod:admin.user.ROLES_REQUIRED',
            'At least one role is required',
          ),
        ),
      groups: z.array(z.string()).optional(),
      is_active: z.boolean(),
    })
    .refine(data => data.password === data.confirm_password, {
      message: i18n.t(
        'zod:auth.PASSWORDS_DO_NOT_MATCH',
        'Passwords do not match',
      ),
      path: ['confirm_password'],
    });
