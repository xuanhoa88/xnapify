/**
 * Posts Zod validation schemas
 *
 * Factory functions receiving { i18n, z } for localized validation.
 * Uses the extension's own translation namespace (posts:).
 */

/**
 * Create post schema
 *
 * @route POST /api/admin/posts
 */
export const createPostFormSchema = ({ i18n, z }) =>
  z.object({
    title: z
      .string()
      .min(1, i18n.t('posts:validations.titleRequired', 'Title is required'))
      .max(255, i18n.t('posts:validations.titleMax', 'Title is too long')),
    slug: z
      .string()
      .max(255, i18n.t('posts:validations.slugMax', 'Slug is too long'))
      .optional(),
    content: z.string().optional(),
    excerpt: z
      .string()
      .max(500, i18n.t('posts:validations.excerptMax', 'Excerpt is too long'))
      .optional(),
    status: z
      .enum(['draft', 'published', 'archived'], {
        errorMap: () => ({
          message: i18n.t(
            'posts:validations.statusInvalid',
            'Status must be draft, published, or archived',
          ),
        }),
      })
      .optional(),
  });

/**
 * Update post schema
 *
 * @route PUT /api/admin/posts/:id
 */
export const updatePostFormSchema = ({ i18n, z }) =>
  z.object({
    title: z
      .string()
      .min(1, i18n.t('posts:validations.titleRequired', 'Title is required'))
      .max(255, i18n.t('posts:validations.titleMax', 'Title is too long'))
      .optional(),
    slug: z
      .string()
      .max(255, i18n.t('posts:validations.slugMax', 'Slug is too long'))
      .optional(),
    content: z.string().optional(),
    excerpt: z
      .string()
      .max(500, i18n.t('posts:validations.excerptMax', 'Excerpt is too long'))
      .optional(),
    status: z
      .enum(['draft', 'published', 'archived'], {
        errorMap: () => ({
          message: i18n.t(
            'posts:validations.statusInvalid',
            'Status must be draft, published, or archived',
          ),
        }),
      })
      .optional(),
  });
