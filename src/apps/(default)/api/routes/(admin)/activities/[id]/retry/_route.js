/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * POST /api/admin/activities/:id/retry
 * Retry activity
 */
export async function post(req, res) {
  const http = req.app.get('http');
  const webhook = req.app.get('webhook');
  const result = await webhook.services.retry(webhook, req.params.id);

  if (result.success) {
    return http.sendSuccess(res, result.data);
  }

  return http.sendError(res, 'Failed to retry activity', result.error);
}
