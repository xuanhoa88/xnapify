/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * DELETE /api/admin/activities/cleanup
 * Cleanup old activities
 */
export async function del(req, res) {
  const http = req.app.get('http');
  const webhook = req.app.get('webhook');
  const options = {
    olderThan: req.query.olderThan
      ? parseInt(req.query.olderThan, 10)
      : undefined,
    status: req.query.status,
  };

  const result = await webhook.services.cleanup(options);

  if (result.success) {
    return http.sendSuccess(res, result.data);
  }

  return http.sendError(res, 'Failed to cleanup activities', result.error);
}
