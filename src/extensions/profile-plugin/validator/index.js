/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Define reusable schema factory
 * This schema can be used on:
 * - Client: for form validation
 * - Server: for API request validation
 */
export const profileSchema = zod => {
  return zod.object({
    profile: zod.object({
      nickname: zod
        .string()
        .min(3, {
          params: {
            i18n: `extension:${__EXTENSION_NAME__}:validations.nickname_too_short`,
          },
        })
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, {
          params: { i18n: 'zod:validations.alphanum' },
        }),
      mobile: zod
        .string()
        .regex(/^\+\d{2} \(\d{3}\) \d{3}-\d{4}$/, {
          params: {
            i18n: `extension:${__EXTENSION_NAME__}:validations.mobile_format`,
          },
        })
        .optional()
        .or(zod.literal('')),
      birthdate: zod
        .string()
        .regex(/^\d{2}\/\d{2}\/\d{4}$/, {
          params: {
            i18n: `extension:${__EXTENSION_NAME__}:validations.birthdate_format`,
          },
        })
        .optional()
        .or(zod.literal('')),
    }),
  });
};
