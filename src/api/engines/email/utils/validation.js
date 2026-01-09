/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Validation Utilities
 */

import { EmailError } from './errors';
import { ERROR_CODES, EMAIL_LIMITS } from './constants';

/**
 * Email regex pattern (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a single email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate email address and throw if invalid
 * @param {string} email - Email address to validate
 * @throws {EmailError} If email is invalid
 */
export function validateEmail(email) {
  if (!isValidEmail(email)) {
    throw new EmailError(
      `Invalid email address: ${email}`,
      ERROR_CODES.INVALID_EMAIL,
      400,
    );
  }
}

/**
 * Validate an array of email addresses
 * @param {Array<string>} emails - Array of email addresses
 * @returns {Object} Validation result with valid and invalid emails
 */
export function validateEmails(emails) {
  if (!Array.isArray(emails)) {
    return { valid: [], invalid: [], isValid: false };
  }

  const valid = [];
  const invalid = [];

  for (const email of emails) {
    if (isValidEmail(email)) {
      valid.push(email.trim());
    } else {
      invalid.push(email);
    }
  }

  return {
    valid,
    invalid,
    isValid: invalid.length === 0 && valid.length > 0,
  };
}

/**
 * Validate complete email data object
 * @param {Object} emailData - Email data to validate
 * @param {string|Array} emailData.to - Recipient(s)
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.body - Email body (text or html)
 * @param {string} [emailData.from] - Sender email
 * @param {Array} [emailData.cc] - CC recipients
 * @param {Array} [emailData.bcc] - BCC recipients
 * @param {Array} [emailData.attachments] - Attachments
 * @throws {EmailError} If validation fails
 * @returns {Object} Normalized email data
 */
export function validateEmailData(emailData) {
  if (!emailData || typeof emailData !== 'object') {
    throw new EmailError(
      'Email data object is required',
      ERROR_CODES.INVALID_INPUT,
      400,
    );
  }

  const { to, subject, html, text, from, cc, bcc, attachments } = emailData;

  // Validate recipients (to is required)
  if (!to) {
    throw new EmailError(
      'Recipient (to) is required',
      ERROR_CODES.INVALID_RECIPIENT,
      400,
    );
  }

  // Normalize recipients to array
  const recipients = Array.isArray(to) ? to : [to];

  // Validate all recipients
  const { valid, invalid, isValid } = validateEmails(recipients);
  if (!isValid) {
    throw new EmailError(
      `Invalid recipient(s): ${invalid.join(', ')}`,
      ERROR_CODES.INVALID_RECIPIENT,
      400,
    );
  }

  // Check recipient limit
  if (valid.length > EMAIL_LIMITS.MAX_RECIPIENTS) {
    throw new EmailError(
      `Too many recipients. Maximum is ${EMAIL_LIMITS.MAX_RECIPIENTS}`,
      ERROR_CODES.INVALID_INPUT,
      400,
    );
  }

  // Validate subject
  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    throw new EmailError('Subject is required', ERROR_CODES.INVALID_INPUT, 400);
  }

  // Validate content (either html or text is required)
  const emailContent = html || text;
  if (
    !emailContent ||
    typeof emailContent !== 'string' ||
    emailContent.trim() === ''
  ) {
    throw new EmailError(
      'Email content is required (html or text)',
      ERROR_CODES.INVALID_INPUT,
      400,
    );
  }

  // Validate from if provided
  if (from && !isValidEmail(from)) {
    throw new EmailError(
      `Invalid sender email: ${from}`,
      ERROR_CODES.INVALID_EMAIL,
      400,
    );
  }

  // Validate CC if provided
  let validCc = [];
  if (cc) {
    const ccEmails = Array.isArray(cc) ? cc : [cc];
    const ccValidation = validateEmails(ccEmails);
    if (!ccValidation.isValid && ccEmails.length > 0) {
      throw new EmailError(
        `Invalid CC recipient(s): ${ccValidation.invalid.join(', ')}`,
        ERROR_CODES.INVALID_RECIPIENT,
        400,
      );
    }
    validCc = ccValidation.valid;
  }

  // Validate BCC if provided
  let validBcc = [];
  if (bcc) {
    const bccEmails = Array.isArray(bcc) ? bcc : [bcc];
    const bccValidation = validateEmails(bccEmails);
    if (!bccValidation.isValid && bccEmails.length > 0) {
      throw new EmailError(
        `Invalid BCC recipient(s): ${bccValidation.invalid.join(', ')}`,
        ERROR_CODES.INVALID_RECIPIENT,
        400,
      );
    }
    validBcc = bccValidation.valid;
  }

  // Validate attachments if provided
  if (attachments) {
    if (!Array.isArray(attachments)) {
      throw new EmailError(
        'Attachments must be an array',
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    if (attachments.length > EMAIL_LIMITS.MAX_ATTACHMENTS) {
      throw new EmailError(
        `Too many attachments. Maximum is ${EMAIL_LIMITS.MAX_ATTACHMENTS}`,
        ERROR_CODES.INVALID_INPUT,
        400,
      );
    }

    for (const attachment of attachments) {
      if (!attachment.filename || !attachment.content) {
        throw new EmailError(
          'Each attachment must have filename and content',
          ERROR_CODES.INVALID_INPUT,
          400,
        );
      }

      // Check attachment size if content is a buffer
      if (
        Buffer.isBuffer(attachment.content) &&
        attachment.content.length > EMAIL_LIMITS.MAX_ATTACHMENT_SIZE
      ) {
        throw new EmailError(
          `Attachment ${attachment.filename} is too large. Maximum size is ${Math.round(EMAIL_LIMITS.MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB`,
          ERROR_CODES.ATTACHMENT_TOO_LARGE,
          400,
        );
      }
    }
  }

  // Return normalized email data
  return {
    to: valid,
    subject: subject.trim(),
    html: html || undefined,
    text: text || undefined,
    from: from || undefined,
    cc: validCc.length > 0 ? validCc : undefined,
    bcc: validBcc.length > 0 ? validBcc : undefined,
    attachments: attachments || undefined,
    ...emailData, // Preserve any additional fields
  };
}

/**
 * Validate template data
 * @param {string} templateId - Template identifier
 * @param {Object} data - Template variables
 * @param {string|Array} recipients - Recipient(s)
 * @throws {EmailError} If validation fails
 * @returns {Object} Validated template data
 */
export function validateTemplateData(templateId, data, recipients) {
  if (!templateId || typeof templateId !== 'string') {
    throw new EmailError(
      'Template ID is required',
      ERROR_CODES.INVALID_TEMPLATE,
      400,
    );
  }

  if (!recipients) {
    throw new EmailError(
      'Recipients are required',
      ERROR_CODES.INVALID_RECIPIENT,
      400,
    );
  }

  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  const { valid, invalid, isValid } = validateEmails(recipientList);

  if (!isValid) {
    throw new EmailError(
      `Invalid recipient(s): ${invalid.join(', ')}`,
      ERROR_CODES.INVALID_RECIPIENT,
      400,
    );
  }

  return {
    templateId: templateId.trim(),
    data: data || {},
    recipients: valid,
  };
}
