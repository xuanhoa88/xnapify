/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import nodeRedRoutes from './node-red.routes';

/**
 * Node-RED Module Factory
 *
 * This module provides integration with Node-RED.
 */
export default function nodeRedModule({ Router }, app) {
  const router = Router();
  const auth = app.get('auth');

  router.use(
    '/node-red',
    auth.requireAuthMiddleware(),
    nodeRedRoutes({ Router }),
  );

  return router;
}
