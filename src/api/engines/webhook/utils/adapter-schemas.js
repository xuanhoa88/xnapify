/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';

/**
 * Common schema fragments for webhook adapters
 */

// Common data schema - accepts any data
export const dataSchema = z.any();

// Common event field
export const eventSchema = z.string().max(1024).optional();

// Common metadata field
export const metadataSchema = z.record(z.any()).optional();

// HTTP-specific schemas
export const urlSchema = z.string().min(1).max(2048).url();
export const secretSchema = z.string().min(1);
export const algorithmSchema = z.string().optional();
export const timeoutSchema = z.number().int().min(1000).max(60000);
export const headersSchema = z.record(z.string());

// Database-specific schemas
export const retriesSchema = z.number().int().min(0).max(10);
export const statusSchema = z.enum(['pending', 'delivered', 'failed']);

/**
 * Create a send input schema for adapters
 * @param {Object} optionsSchema - Zod schema for options
 * @returns {Object} Complete send input schema
 */
export function createSendSchema(optionsSchema) {
  return z.object({
    data: dataSchema,
    options: optionsSchema.optional().default({}),
  });
}
