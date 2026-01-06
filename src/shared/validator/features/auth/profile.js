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
  z
    .object({
      currentPassword: passwordRule({ i18n: i18n, z: z }),
      newPassword: strongPasswordRule({ i18n: i18n, z: z }),
      confirmNewPassword: z.string(),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: i18n.t(
        'zod:auth.PASSWORDS_DO_NOT_MATCH',
        'Passwords do not match',
      ),
      path: ['confirmNewPassword'],
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
      password: passwordRule({ i18n: i18n, z: z }),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: i18n.t(
        'zod:auth.PASSWORDS_DO_NOT_MATCH',
        'Passwords do not match',
      ),
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
      .max(
        100,
        i18n.t('zod:profile.DISPLAY_NAME_MAX', 'Display name is too long'),
      )
      .optional(),
    first_name: z
      .string()
      .max(50, i18n.t('zod:profile.FIRST_NAME_MAX', 'First name is too long'))
      .optional(),
    last_name: z
      .string()
      .max(50, i18n.t('zod:profile.LAST_NAME_MAX', 'Last name is too long'))
      .optional(),
    bio: z
      .string()
      .max(500, i18n.t('zod:profile.BIO_MAX', 'Bio is too long'))
      .optional(),
    location: z
      .string()
      .max(100, i18n.t('zod:profile.LOCATION_MAX', 'Location is too long'))
      .optional(),
    website: z
      .string()
      .url(i18n.t('zod:profile.WEBSITE_INVALID', 'Website is invalid'))
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
      .regex(
        /^[a-z]{2}(-[A-Z]{2})?$/,
        i18n.t(
          'zod:preferences.LANGUAGE_INVALID',
          'Invalid locale code (e.g., en-US, vi-VN)',
        ),
      )
      .optional(),
    timezone: z
      .string()
      .max(
        50,
        i18n.t(
          'zod:preferences.TIMEZONE_MAX',
          'Timezone code must be 50 characters or less',
        ),
      )
      .optional(),
    notifications: z.record(z.boolean()).optional(),
    theme: z
      .enum(['light', 'dark', 'system'], {
        errorMap: () => ({
          message: i18n.t(
            'zod:preferences.THEME_INVALID',
            'Theme must be one of light, dark, or system',
          ),
        }),
      })
      .optional(),
  });

/**
 * Avatar upload schema - callable factory function
 *
 * Used by:
 * - Backend: POST /api/profile/avatar (for validating file metadata)
 */
export const avatarUploadFormSchema = ({ i18n, z }) =>
  z.object({
    // File validation is done via multer middleware
    // This schema validates the file object after multer processing
    file: z
      .object({
        fieldname: z.string(),
        originalname: z.string(),
        encoding: z.string(),
        mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif'], {
          errorMap: () => ({
            message: i18n.t(
              'zod:profile.AVATAR_INVALID_TYPE',
              'Avatar must be a JPEG, PNG, or GIF image',
            ),
          }),
        }),
        size: z.number().max(5 * 1024 * 1024, {
          message: i18n.t(
            'zod:profile.AVATAR_TOO_LARGE',
            'Avatar must be less than 5MB',
          ),
        }),
      })
      .optional(),
  });

/**
 * Link avatar schema - callable factory function
 *
 * Used by:
 * - Backend: PUT /api/profile/avatar
 */
export const linkAvatarFormSchema = ({ i18n, z }) =>
  z.object({
    fileName: z
      .string()
      .min(1, i18n.t('zod:profile.FILENAME_REQUIRED', 'File name is required')),
  });
