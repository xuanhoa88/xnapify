/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from '../../../shared/validator';
import { addNamespace } from '../../../shared/i18n/addNamespace';
import { getTranslations } from '../../../shared/i18n/getTranslations';
import { PLUGIN_ID } from '../constants';

// 1. Register translations for this plugin
// This ensures that when the validator runs, it has access to the plugin's error messages
addNamespace(
  PLUGIN_ID,
  getTranslations(require.context('./translations', false, /\.json$/i)),
);

/**
 * 2. Define reusable schema factory
 *
 * We export a factory function that takes { i18n, z } (though we import z directly here for convenience,
 * following the pattern in shared/validator/index.js allows for dependency injection if needed).
 *
 * This schema can be used on:
 * - Client: for form validation
 * - Server: for API request validation
 */
export const profileSchema = () => {
  return z.object({
    nickname: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/, {
        params: { i18n: 'zod:validations.alphanum' }, // Use shared Zod message
      }),

    bio: z.string().max(160, {
      message: `${PLUGIN_ID}:validations.bio_too_long`, // Custom plugin message
    }),
  });
};

// Export the z instance for convenience if other files want to use the same configured instance
export { z };
