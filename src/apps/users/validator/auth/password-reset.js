/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { emailRule, strongPasswordRule } from './common';

/**
 * Password reset request schema - callable factory function
 *
 * Used by:
 * - Frontend: Password reset request form
 * - Backend: POST /api/users/reset-password/request
 */
export const passwordResetRequestFormSchema = ({ i18n, z }) =>
  z.object({
    email: emailRule({ i18n: i18n, z: z }),
  });

/**
 * Password reset confirmation schema - callable factory function
 *
 * Used by:
 * - Frontend: Password reset confirmation form
 * - Backend: POST /api/users/password-reset/confirmation
 */
export const passwordResetConfirmFormSchema = ({ i18n, z }) =>
  z
    .object({
      token: z
        .string()
        .min(1, i18n.t('zod:auth.TOKEN_REQUIRED', 'Token is required')),
      password: strongPasswordRule({ i18n: i18n, z: z }),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: i18n.t(
        'zod:auth.PASSWORDS_DO_NOT_MATCH',
        'Passwords do not match',
      ),
      path: ['confirmPassword'],
    });
