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
  z
    .object({
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
      password: z
        .union([
          z.literal(''), // Allow empty string for no password change
          strongPasswordRule({ i18n, z }),
        ])
        .optional(),
      password_confirmation: z.string().optional(),
      roles: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
      is_active: z.boolean(),
    })
    .refine(
      data => {
        // If password is provided and not empty, confirmation must match
        if (data.password && data.password !== '') {
          return data.password === data.password_confirmation;
        }
        return true;
      },
      {
        message: i18n.t(
          'zod:auth.PASSWORDS_DO_NOT_MATCH',
          'Passwords do not match',
        ),
        path: ['password_confirmation'],
      },
    );

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
      roles: z.array(z.string()).optional(),
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

/**
 * Bulk update user status schema - callable factory function
 *
 * Used by:
 * - Backend: PATCH /api/admin/users/status
 */
export const bulkUpdateUserStatusFormSchema = ({ i18n, z }) =>
  z.object({
    ids: z
      .array(z.string().uuid())
      .min(
        1,
        i18n.t(
          'zod:admin.user.IDS_REQUIRED',
          'At least one user ID is required',
        ),
      ),
    state: z.enum(['active', 'inactive'], {
      errorMap: () => ({
        message: i18n.t(
          'zod:admin.permission.STATE_REQUIRED',
          'State must be either active or inactive',
        ),
      }),
    }),
  });

/**
 * Update user lock status schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/admin/users/:id/lock
 */
export const updateUserLockStatusFormSchema = ({ i18n, z }) =>
  z.object({
    is_locked: z.boolean({
      required_error: i18n.t(
        'zod:admin.user.IS_LOCKED_REQUIRED',
        'Lock status is required',
      ),
      invalid_type_error: i18n.t(
        'zod:admin.user.IS_LOCKED_INVALID',
        'Lock status must be true or false',
      ),
    }),
    reason: z
      .string()
      .max(500, i18n.t('zod:admin.user.REASON_MAX', 'Reason is too long'))
      .optional(),
  });

/**
 * Bulk delete users schema - callable factory function
 *
 * Used by:
 * - Backend: DELETE /api/admin/users
 */
export const bulkDeleteUserFormSchema = ({ i18n, z }) =>
  z.object({
    ids: z
      .array(z.string().uuid())
      .min(
        1,
        i18n.t(
          'zod:admin.user.IDS_REQUIRED',
          'At least one user ID is required',
        ),
      ),
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
