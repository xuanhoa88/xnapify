/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';

/**
 * Password validation rules
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Email schema - reusable email validation
 */
export const emailSchema = z
  .string()
  .min(1, 'EMAIL_REQUIRED')
  .email('EMAIL_INVALID');

/**
 * Password schema - reusable password validation for login
 * (just requires non-empty for login)
 */
export const passwordSchema = z.string().min(1, 'PASSWORD_REQUIRED');

/**
 * Strong password schema - for registration and password reset
 * (requires minimum length)
 */
export const strongPasswordSchema = z
  .string()
  .min(1, 'PASSWORD_REQUIRED')
  .min(PASSWORD_MIN_LENGTH, 'PASSWORD_MIN_LENGTH')
  .max(PASSWORD_MAX_LENGTH, 'PASSWORD_MAX_LENGTH');
