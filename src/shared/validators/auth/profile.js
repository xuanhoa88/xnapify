/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';
import { strongPasswordSchema } from '../common';

/**
 * Change password schema
 *
 * Used by:
 * - Frontend: Change password form
 * - Backend: PUT /api/profile/password
 */
export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'PASSWORD_REQUIRED'),
  newPassword: strongPasswordSchema,
});

/**
 * Delete account schema
 *
 * Used by:
 * - Frontend: Delete account confirmation
 * - Backend: DELETE /api/profile
 */
export const deleteAccountFormSchema = z.object({
  password: z.string().min(1, 'PASSWORD_REQUIRED'),
  confirm: z.literal('DELETE_MY_ACCOUNT', {
    errorMap: () => ({ message: 'CONFIRMATION_REQUIRED' }),
  }),
});

/**
 * Update profile schema
 *
 * Used by:
 * - Frontend: Profile edit form
 * - Backend: PUT /api/profile
 */
export const updateProfileFormSchema = z.object({
  display_name: z.string().max(100).optional(),
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

/**
 * Update preferences schema
 *
 * Used by:
 * - Frontend: Preferences form
 * - Backend: PUT /api/profile/preferences
 */
export const updatePreferencesFormSchema = z.object({
  language: z.string().length(2).optional(),
  timezone: z.string().max(50).optional(),
  notifications: z.record(z.boolean()).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});
