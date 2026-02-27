/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GET /api/admin/activities/:id
 * Get activity by ID
 */
export async function get(req, res) {
  const http = req.app.get('http');
  const webhook = req.app.get('webhook');
  const result = await webhook.services.getById(req.params.id);

  if (result.success) {
    return http.sendSuccess(res, result.data);
  }

  return http.sendError(res, 'Failed to get activity', result.error);
}
