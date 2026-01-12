/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Router } from 'express';
import * as http from '../http';
import * as services from './services';

/**
 * Handle operation result
 * @private
 */
function handleResult(res, result) {
  if (result.success) {
    return http.sendSuccess(res, result.data, result.message);
  }

  // Handle operation errors
  if (result.error) {
    const { status = 500, message } = result.error;
    return http.sendError(res, message, status, null, result.error);
  }

  return http.sendServerError(res, result.message || 'Operation failed');
}

/**
 * Create Webhook Router
 *
 * @param {Object} webhook - WebhookManager instance
 * @returns {Router} Express router
 */
export function createControllers(webhook) {
  const router = Router();

  // GET / - List webhooks
  router.get('/', async (req, res) => {
    try {
      const options = {
        ...req.query,
        ...http.getPagination(req),
      };

      const result = await services.list(webhook, options);
      handleResult(res, result);
    } catch (error) {
      http.sendServerError(res, 'Failed to list webhooks');
    }
  });

  // GET /stats - Get statistics
  router.get('/stats', async (req, res) => {
    try {
      const result = await services.stats(webhook);
      handleResult(res, result);
    } catch (error) {
      http.sendServerError(res, 'Failed to get statistics');
    }
  });

  // GET /pending - Get pending retries
  router.get('/pending', async (req, res) => {
    try {
      const result = await services.pending(webhook, req.query);
      handleResult(res, result);
    } catch (error) {
      http.sendServerError(res, 'Failed to get pending webhooks');
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
      http.sendServerError(res, 'Failed to cleanup webhooks');
    }
  });

  // GET /:id - Get webhook by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await services.getById(webhook, req.params.id);
      handleResult(res, result);
    } catch (error) {
      http.sendServerError(res, 'Failed to get webhook');
    }
  });

  // POST /:id/retry - Retry webhook
  router.post('/:id/retry', async (req, res) => {
    try {
      const result = await services.retry(webhook, req.params.id);
      handleResult(res, result);
    } catch (error) {
      http.sendServerError(res, 'Failed to retry webhook');
    }
  });

  return router;
}
