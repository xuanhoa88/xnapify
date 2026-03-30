/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { emailRule, passwordRule } from './common';

/**
 * Login schema - callable factory function
 *
 * Used by:
 * - Frontend: Login form validation
 * - Backend: POST /api/login
 */
export const loginFormSchema = ({ i18n, z }) =>
  z.object({
    email: emailRule({ i18n: i18n, z: z }),
    password: passwordRule({ i18n: i18n, z: z }),
    rememberMe: z.boolean().optional(),
  });
