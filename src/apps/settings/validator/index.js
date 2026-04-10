/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';

/**
 * Valid setting types
 */
const SETTING_TYPES = ['string', 'boolean', 'integer', 'json', 'password'];

/**
 * Schema for a single setting update
 */
export const settingUpdateSchema = z.object({
  namespace: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9_-]+$/i,
      'Namespace must contain only letters, numbers, hyphens, and underscores',
    ),
  key: z.string().min(1).max(255),
  value: z.union([z.string(), z.null()]),
});

/**
 * Schema for bulk settings update request body
 */
export const bulkUpdateSchema = z.object({
  updates: z.array(settingUpdateSchema).min(1).max(100),
});

/**
 * Schema for creating a new setting (admin/dev use)
 */
export const settingCreateSchema = z.object({
  namespace: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/i),
  key: z.string().min(1).max(255),
  type: z.enum(SETTING_TYPES).default('string'),
  value: z.union([z.string(), z.null()]).optional(),
  default_env_var: z.string().max(255).nullable().optional(),
  is_public: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

/**
 * Schema for updating an arbitrary settings namespace payload
 */
export const namespaceUpdateSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
