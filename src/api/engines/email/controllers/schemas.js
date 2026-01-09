/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Validation Schemas using Zod
 * These schemas are factory functions that receive { i18n, z } and return Zod schemas
 */

import { EMAIL_LIMITS } from '../utils/constants';

/**
 * Common email address validation
 */
const emailAddressSchema = ({ z }) => z.string().min(1).email();

/**
 * Recipients field - can be string or array of strings
 */
const recipientsSchema = ({ z }) =>
  z.union([
    emailAddressSchema({ z }),
    z.array(emailAddressSchema({ z })).min(1).max(EMAIL_LIMITS.MAX_RECIPIENTS),
  ]);

/**
 * Optional recipients field
 */
const optionalRecipientsSchema = ({ z }) =>
  z
    .union([
      emailAddressSchema({ z }),
      z.array(emailAddressSchema({ z })).max(EMAIL_LIMITS.MAX_RECIPIENTS),
    ])
    .optional();

/**
 * Attachment schema
 */
const attachmentSchema = ({ z }) =>
  z.object({
    filename: z.string().min(1),
    content: z.any(), // Buffer or base64 string
    contentType: z.string().optional(),
    disposition: z.enum(['attachment', 'inline']).optional(),
  });

/**
 * Single email item schema
 */
const emailItemSchema = ({ i18n, z }) =>
  z
    .object({
      // Recipients
      to: recipientsSchema({ z }),
      cc: optionalRecipientsSchema({ z }),
      bcc: optionalRecipientsSchema({ z }),

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
      from: emailAddressSchema({ z }).optional(),
      fromName: z.string().max(255).optional(),
      replyTo: emailAddressSchema({ z }).optional(),

      // Attachments
      attachments: z
        .array(attachmentSchema({ z }))
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
        message: i18n.t('zod:email.CONTENT_REQUIRED'),
        path: ['html'],
      },
    );

/**
 * Send emails form schema - Always an array
 * Single: [{ to, subject, html }]
 * Bulk: [{ to, subject, html }, { to, subject, html }, ...]
 */
export const sendEmailsFormSchema = ({ i18n, z }) =>
  z
    .array(emailItemSchema({ i18n, z }))
    .min(1, { message: i18n.t('zod:email.EMAILS_REQUIRED') })
    .max(EMAIL_LIMITS.MAX_BATCH_SIZE, {
      message: i18n.t('zod:email.BATCH_SIZE_EXCEEDED', {
        max: EMAIL_LIMITS.MAX_BATCH_SIZE,
      }),
    });
