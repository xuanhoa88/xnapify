/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email verification form schema - callable factory function
 *
 * Used by:
 * - Backend: POST /api/users/email-verification
 * - Frontend: Email verification form validation
 */
export const emailVerificationFormSchema = ({ i18n, z }) =>
  z.object({
    token: z
      .string()
      .min(1, i18n.t('zod:auth.TOKEN_REQUIRED', 'Token is required')),
  });
