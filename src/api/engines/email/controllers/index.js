/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Controllers - Main Export File
 *
 * This file exports all controllers and utility functions for email operations.
 */

// Import controllers for internal use
import { sendEmail } from './send.controller';

/**
 * Create action-based email controllers
 * @returns {Object} Object containing all action-based controllers that accept options
 */
export function createControllers() {
  return {
    send:
      (options = {}) =>
      (req, res) =>
        sendEmail(req, res, options),
  };
}

/**
 * Create email routes for Express app
 * @param {Function} Router - Express Router constructor
 * @param {Object} options - Controller options
 * @param {Object} options.send - Send controller options
 * @returns {Router} Express router with email routes
 *
 * @example
 * // Basic usage
 * app.use('/api/email', createRouter(Router));
 *
 * // With options
 * app.use('/api/email', createRouter(Router, {
 *   send: { provider: 'sendgrid', batchThreshold: 10 }
 * }));
 *
 * // API Usage (body is always an array):
 * // Single:   POST /api/email/send [{ to, subject, html }]
 * // Multiple: POST /api/email/send [{ to, subject, html }, { to, subject, html }]
 * // Template: POST /api/email/send [{ to, templateId, templateData }]
 */
export function createRouter(Router, options = {}) {
  // Create action-based controllers
  const controllers = createControllers();

  // Create router
  const router = Router();

  // Unified send endpoint (single + bulk + templates)
  router.post('/send', controllers.sendEmail(options.send));

  // Error handling middleware
  router.use((error, req, res, next) => {
    // Handle EmailError locally
    if (error.name === 'EmailError') {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Pass other errors to global http.errorHandler
    next(error);
  });

  return router;
}
