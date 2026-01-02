/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { emailSchema, strongPasswordSchema } from '../common';

/**
 * Registration form schema (frontend with confirmPassword)
 *
 * Used by:
 * - Backend: POST /api/register
 * - Frontend: Registration form validation
 */
export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'CONFIRM_PASSWORD_REQUIRED'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'PASSWORDS_DO_NOT_MATCH',
    path: ['confirmPassword'],
  });
