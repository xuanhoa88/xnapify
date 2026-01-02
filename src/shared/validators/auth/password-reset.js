/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { emailSchema, strongPasswordSchema } from '../common';

/**
 * Password reset request schema
 *
 * Used by:
 * - Frontend: Password reset request form
 * - Backend: POST /api/users/reset-password/request
 */
export const passwordResetRequestFormSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset confirmation schema
 *
 * Used by:
 * - Frontend: Password reset confirmation form
 * - Backend: POST /api/users/password-reset/confirmation
 */
export const passwordResetConfirmFormSchema = z
  .object({
    token: z.string().min(1, 'RESET_TOKEN_REQUIRED'),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'CONFIRM_PASSWORD_REQUIRED'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'PASSWORDS_DO_NOT_MATCH',
    path: ['confirmPassword'],
  });
