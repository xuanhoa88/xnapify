/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as services from './services';

/**
 * Create standardized response object
 * @private
 */
function createResponse(success, data = null, message = null, meta = null) {
  const response = {
    success,
    timestamp: new Date().toISOString(),
  };

  if (data != null) response.data = data;
  if (message) response.message = message;
  if (meta) response.meta = meta;

  return response;
}

/**
 * Handle operation result
 * @private
 */
function handleResult(res, result) {
  if (result.success) {
    return res
      .status(200)
      .json(createResponse(true, result.data, result.message));
  }

  // Handle operation errors
  if (result.error) {
    const { status = 500, message } = result.error;
    const response = createResponse(false, null, message);
    if (result.error) {
      // Ideally we should separate "errors" from "error object" but matching previous behavior:
      // http.sendError passed result.error as the 'errors' argument (?)
      // check prior implementation: sendError(res, message, statusCode, errors, meta)
      // prior call: http.sendError(res, message, status, null, result.error) -> wait, 4th arg is errors, 5th is meta
      // The original code was: http.sendError(res, message, status, null, result.error);
      // So 'errors' was null, and 'meta' was result.error.
      // So I should put result.error in meta?
      // createResponse(false, null, message, result.error)
      response.meta = result.error;
    }
    return res.status(status).json(response);
  }

  return res
    .status(500)
    .json(createResponse(false, null, result.message || 'Operation failed'));
}

/**
 * Extract pagination parameters
 * @private
 */
function getPagination(req) {
  const defaults = { page: 1, limit: 10, maxLimit: 100 };
  const page = Math.max(1, parseInt(req.query.page, 10) || defaults.page);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(req.query.limit, 10) || defaults.limit),
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Create Webhook Router
 *
 * @param {Object} webhook - WebhookManager instance
 * @param {Object} options - Options
 * @param {Function} options.Router - Express Router constructor
 * @returns {Router} Express router
 */
export function createControllers(webhook, { Router }) {
  const router = Router();

  // GET / - List webhooks
  router.get('/', async (req, res) => {
    try {
      const options = {
        ...req.query,
        ...getPagination(req),
      };

      const result = await services.list(webhook, options);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to list webhooks'));
    }
  });

  // GET /stats - Get statistics
  router.get('/stats', async (req, res) => {
    try {
      const result = await services.stats(webhook);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to get statistics'));
    }
  });

  // GET /pending - Get pending retries
  router.get('/pending', async (req, res) => {
    try {
      const result = await services.pending(webhook, req.query);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to get pending webhooks'));
    }
  });

  // DELETE /cleanup - Cleanup old webhooks
  router.delete('/cleanup', async (req, res) => {
    try {
      const options = {
        olderThan: req.query.olderThan
          ? parseInt(req.query.olderThan, 10)
          : undefined,
        status: req.query.status,
      };

      const result = await services.cleanup(webhook, options);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to cleanup webhooks'));
    }
  });

  // GET /:id - Get webhook by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await services.getById(webhook, req.params.id);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to get webhook'));
    }
  });

  // POST /:id/retry - Retry webhook
  router.post('/:id/retry', async (req, res) => {
    try {
      const result = await services.retry(webhook, req.params.id);
      handleResult(res, result);
    } catch (error) {
      res
        .status(500)
        .json(createResponse(false, null, 'Failed to retry webhook'));
    }
  });

  return router;
}
