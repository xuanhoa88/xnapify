/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as healthController from '../../controllers/health.controller.js';

// Readiness probe — no auth, no rate limit, no inherited middleware
export const middleware = false;
export const useRateLimit = false;

/**
 * @route GET /api/ready
 */
export const get = healthController.ready;
