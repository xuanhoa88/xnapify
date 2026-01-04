/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { passwordRule, strongPasswordRule } from './common';

/**
 * Change password schema - callable factory function
 *
 * Used by:
 * - Frontend: Change password form
 * - Backend: PUT /api/profile/password
 */
export const changePasswordFormSchema = ({ i18n, z }) =>
  z.object({
    currentPassword: passwordRule({ i18n: i18n, z: z }),
    newPassword: strongPasswordRule({ i18n: i18n, z: z }),
  });

/**
 * Delete account schema - callable factory function
 *
 * Used by:
 * - Frontend: Delete account form
 * - Backend: DELETE /api/profile
 */
export const deleteAccountFormSchema = ({ i18n, z }) =>
  z
    .object({
      password: strongPasswordRule({ i18n: i18n, z: z }),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: i18n.t('zod:auth.PASSWORDS_DO_NOT_MATCH'),
      path: ['confirmPassword'],
    });

/**
 * Update profile schema - callable factory function
 *
 * Used by:
 * - Frontend: Profile edit form
 * - Backend: PUT /api/profile
 */
export const updateProfileFormSchema = ({ i18n, z }) =>
  z.object({
    display_name: z
      .string()
      .max(100, i18n.t('zod:profile.DISPLAY_NAME_MAX'))
      .optional(),
    first_name: z
      .string()
      .max(50, i18n.t('zod:profile.FIRST_NAME_MAX'))
      .optional(),
    last_name: z
      .string()
      .max(50, i18n.t('zod:profile.LAST_NAME_MAX'))
      .optional(),
    bio: z.string().max(500, i18n.t('zod:profile.BIO_MAX')).optional(),
    location: z
      .string()
      .max(100, i18n.t('zod:profile.LOCATION_MAX'))
      .optional(),
    website: z
      .string()
      .url(i18n.t('zod:profile.WEBSITE_INVALID'))
      .optional()
      .or(z.literal('')),
  });

/**
 * Update preferences schema - callable factory function
 *
 * Used by:
 * - Frontend: Preferences form
 * - Backend: PUT /api/profile/preferences
 */
export const updatePreferencesFormSchema = ({ i18n, z }) =>
  z.object({
    language: z
      .string()
      .length(2, i18n.t('zod:preferences.LANGUAGE_INVALID'))
      .optional(),
    timezone: z
      .string()
      .max(50, i18n.t('zod:preferences.TIMEZONE_MAX'))
      .optional(),
    notifications: z.record(z.boolean()).optional(),
    theme: z
      .enum(['light', 'dark', 'system'], {
        errorMap: () => ({ message: i18n.t('zod:preferences.THEME_INVALID') }),
      })
      .optional(),
  });
