/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { z } from '../../../../validator';

/**
 * Email Validation - Zod Schema
 */

// Rate limiting and batch sizes
export const EMAIL_LIMITS = Object.freeze({
  MAX_RECIPIENTS: 50, // Max recipients per email
  MAX_BATCH_SIZE: 100, // Max emails per batch
  MAX_ATTACHMENTS: 10, // Max attachments per email
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB body size
});

/**
 * Common email address validation
 */
const emailAddressSchema = z.string().min(1).email();

/**
 * Recipients field - can be string or array of strings
 */
const recipientsSchema = z.union([
  emailAddressSchema,
  z.array(emailAddressSchema).min(1).max(EMAIL_LIMITS.MAX_RECIPIENTS),
]);

/**
 * Optional recipients field
 */
const optionalRecipientsSchema = z
  .union([
    emailAddressSchema,
    z.array(emailAddressSchema).max(EMAIL_LIMITS.MAX_RECIPIENTS),
  ])
  .optional();

/**
 * Attachment schema
 */
const attachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.any(), // Buffer or base64 string
  contentType: z.string().optional(),
  disposition: z.enum(['attachment', 'inline']).optional(),
});

/**
 * Single email item schema
 */
const emailItemSchema = z
  .object({
    // Recipients
    to: recipientsSchema,
    cc: optionalRecipientsSchema,
    bcc: optionalRecipientsSchema,

    // Subject (required unless using provider template)
    subject: z.string().max(998).optional(),

    // Raw HTML/text content
    html: z.string().max(EMAIL_LIMITS.MAX_BODY_SIZE).optional(),
    text: z.string().max(EMAIL_LIMITS.MAX_BODY_SIZE).optional(),

    // Template data for {{placeholder}} substitution in html/text/subject
    templateData: z.record(z.any()).optional(),

    // Provider template ID (SendGrid/Mailgun)
    templateId: z.string().optional(),

    // Sender
    from: emailAddressSchema.optional(),
    fromName: z.string().max(255).optional(),
    replyTo: emailAddressSchema.optional(),

    // Attachments
    attachments: z
      .array(attachmentSchema)
      .max(EMAIL_LIMITS.MAX_ATTACHMENTS)
      .optional(),

    // Custom headers
    headers: z.record(z.string()).optional(),

    // Priority
    priority: z.enum(['high', 'normal', 'low']).optional(),
  })
  .refine(
    data => {
      // Must have content: html, text, or templateId
      return !!(data.html || data.text || data.templateId);
    },
    {
      message: 'Email must have html, text, or templateId content',
      path: ['html'],
    },
  );

/**
 * Send emails schema - Always an array
 * Single: [{ to, subject, html }]
 * Bulk: [{ to, subject, html }, { to, subject, html }, ...]
 */
export const sendEmailsSchema = z
  .array(emailItemSchema)
  .min(1, { message: 'At least one email is required' })
  .max(EMAIL_LIMITS.MAX_BATCH_SIZE, {
    message: `Maximum ${EMAIL_LIMITS.MAX_BATCH_SIZE} emails per batch`,
  });

/**
 * Validate email data
 * @param {Array} data - Email data to validate
 * @returns {{ success: boolean, data?: Array, error?: Object }} Validation result
 */
export function validateEmails(data) {
  return sendEmailsSchema.safeParse(data);
}
