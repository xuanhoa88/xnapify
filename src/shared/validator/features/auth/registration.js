/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { emailRule, strongPasswordRule } from './common';

/**
 * Registration form schema - callable factory function
 *
 * Used by:
 * - Backend: POST /api/register
 * - Frontend: Registration form validation
 */
export const registerFormSchema = ({ i18n, z }) =>
  z
    .object({
      email: emailRule({ i18n: i18n, z: z }),
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
