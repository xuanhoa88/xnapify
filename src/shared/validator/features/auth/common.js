/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Constants for password validation
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 100;

/**
 * Email validation rule - factory function receiving i18n and z
 * Translates messages dynamically based on current locale
 */
export const emailRule = ({ i18n, z }) =>
  z
    .string()
    .min(1, i18n.t('zod:auth.EMAIL_REQUIRED'))
    .email(i18n.t('zod:auth.EMAIL_INVALID'));

/**
 * Password validation rule - factory function for login validation
 * (just requires non-empty for login)
 */
export const passwordRule = ({ i18n, z }) =>
  z.string().min(1, i18n.t('zod:auth.PASSWORD_REQUIRED'));

/**
 * Strong password validation rule - for registration and password reset
 * (requires minimum and maximum length with interpolated values)
 */
export const strongPasswordRule = ({ i18n, z }) =>
  z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      i18n.t('zod:auth.PASSWORD_MIN_LENGTH', { min: PASSWORD_MIN_LENGTH }),
    )
    .max(
      PASSWORD_MAX_LENGTH,
      i18n.t('zod:auth.PASSWORD_MAX_LENGTH', { max: PASSWORD_MAX_LENGTH }),
    );
