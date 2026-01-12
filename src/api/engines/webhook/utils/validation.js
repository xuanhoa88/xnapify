/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from 'zod';

/**
 * Webhook Validation - Zod Schema
 */

// Webhook limits
export const WEBHOOK_LIMITS = Object.freeze({
  MAX_BATCH_SIZE: 100, // Max webhooks per batch
  MAX_PAYLOAD_SIZE: 1024 * 1024, // 1MB payload size
  MAX_URL_LENGTH: 2048, // Max URL length
});

/**
 * URL validation schema
 */
const urlSchema = z.string().min(1).max(WEBHOOK_LIMITS.MAX_URL_LENGTH).url();

/**
 * Single webhook item schema
 * payload.url is required for the target URL
 */
const webhookItemSchema = z.object({
  payload: z
    .object({
      url: urlSchema,
    })
    .passthrough(),
  options: z
    .object({
      secret: z.string().optional(),
      event: z.string().optional(),
      retries: z.number().int().min(0).max(10).optional(),
      timeout: z.number().int().min(1000).max(60000).optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
});

/**
 * Send webhook(s) schema
 * Single: { url, payload }
 * Batch: [{ url, payload }, { url, payload }, ...]
 */
export const sendWebhookSchema = z.union([
  // Single webhook
  webhookItemSchema,
  // Batch webhooks
  z.array(webhookItemSchema).min(1).max(WEBHOOK_LIMITS.MAX_BATCH_SIZE),
]);

/**
 * Validate webhook data
 * @param {Object|Array} data - Webhook data to validate
 * @returns {{ success: boolean, data?: Object, error?: Object }} Validation result
 */
export function validateWebhook(data) {
  return sendWebhookSchema.safeParse(data);
}
