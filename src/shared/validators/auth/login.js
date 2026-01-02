/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { emailSchema, passwordSchema } from '../common';

/**
 * Login schema
 *
 * Used by:
 * - Frontend: Login form validation
 * - Backend: POST /api/login
 */
export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional(),
});
