/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Create email template form schema factory
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const createEmailTemplateFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_NAME_REQUIRED',
          'Template name is required',
        ),
      )
      .max(
        100,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_NAME_MAX_LENGTH',
          'Template name must be 100 characters or less',
        ),
      ),
    slug: z
      .string()
      .min(
        1,
        i18n.t('zod:admin.EMAIL_TEMPLATE_SLUG_REQUIRED', 'Slug is required'),
      )
      .max(
        100,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SLUG_MAX_LENGTH',
          'Slug must be 100 characters or less',
        ),
      )
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SLUG_FORMAT',
          'Slug must be lowercase alphanumeric with hyphens',
        ),
      ),
    subject: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SUBJECT_REQUIRED',
          'Subject is required',
        ),
      )
      .max(
        500,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH',
          'Subject must be 500 characters or less',
        ),
      ),
    html_body: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_BODY_REQUIRED',
          'Email body is required',
        ),
      ),
    is_active: z.boolean().optional().default(true),
  });

/**
 * Update email template form schema factory
 *
 * @param {Object} params - Schema factory parameters
 * @param {Object} params.i18n - i18next instance for translations
 * @param {Object} params.z - Zod library
 * @returns {Object} Zod schema
 */
export const updateEmailTemplateFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_NAME_REQUIRED',
          'Template name is required',
        ),
      )
      .max(
        100,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_NAME_MAX_LENGTH',
          'Template name must be 100 characters or less',
        ),
      ),
    slug: z
      .string()
      .min(
        1,
        i18n.t('zod:admin.EMAIL_TEMPLATE_SLUG_REQUIRED', 'Slug is required'),
      )
      .max(
        100,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SLUG_MAX_LENGTH',
          'Slug must be 100 characters or less',
        ),
      )
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SLUG_FORMAT',
          'Slug must be lowercase alphanumeric with hyphens',
        ),
      ),
    subject: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SUBJECT_REQUIRED',
          'Subject is required',
        ),
      )
      .max(
        500,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH',
          'Subject must be 500 characters or less',
        ),
      ),
    html_body: z
      .string()
      .min(
        1,
        i18n.t(
          'zod:admin.EMAIL_TEMPLATE_BODY_REQUIRED',
          'Email body is required',
        ),
      ),
    is_active: z.boolean().optional().default(true),
  });
