/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Send Email Controller
 *
 * Handles HTTP requests for sending emails.
 * Request body must be an array of email objects.
 */

import { validateForm } from '../../../../shared/validator';
import { send } from '../send';
import { sendEmailsFormSchema } from './schemas';

/**
 * Unified email send API
 * Request body must be an array of email objects
 *
 * @example
 * // Single email
 * POST /send [{ to: "user@example.com", subject: "Hi", html: "<p>Hello</p>" }]
 *
 * // Multiple emails
 * POST /send [
 *   { to: "user1@example.com", subject: "Hi 1", html: "<p>Hello 1</p>" },
 *   { to: "user2@example.com", subject: "Hi 2", html: "<p>Hello 2</p>" }
 * ]
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 */
export async function sendEmail(req, res, options = {}) {
  try {
    const emails = req.body;

    // Validate request body is an array
    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must be an array of email objects',
      });
    }

    // Validate using Zod schema
    const [isValid, validationErrors] = validateForm(
      sendEmailsFormSchema,
      emails,
    );
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validationErrors,
      });
    }

    // Send emails (action handles worker decision internally)
    const result = await send(emails, options);

    const statusCode = result.success
      ? 200
      : (result.error && result.error.statusCode) || 500;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message,
    });
  }
}
