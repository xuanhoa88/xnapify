/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Node-RED Integration Routes
 *
 * Provides endpoints to interact with Node-RED instance.
 */
export default function nodeRedRoutes({ Router }) {
  const router = Router();

  /**
   * GET /
   * Check Node-RED integration status
   */
  router.get('/', (req, res) => {
    const http = req.app.get('http');
    return http.sendSuccess(res, {
      status: 'active',
      message: 'Node-RED integration is ready',
      config: {
        url: process.env.RSK_NODE_RED_URL || 'http://localhost:1880',
      },
    });
  });

  return router;
}
