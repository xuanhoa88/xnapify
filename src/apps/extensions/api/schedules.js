/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { recalculateUpdateCount } from './services/hub.service.js';

/**
 * Registers background scheduled tasks for the Extensions module.
 */
export function registerSchedules(container) {
  const schedule = container.resolve('schedule');

  // Check for extension updates every 4 hours
  // '0 */4 * * *'
  schedule.register('extensions:check-updates', '0 */4 * * *', async () => {
    try {
      const updateCount = await recalculateUpdateCount({
        models: container.resolve('models'),
        cache: container.resolve('cache'),
        ws: container.resolve('ws'),
      });
      if (updateCount != null) {
        console.info(`[Extensions] Found ${updateCount} updates available.`);
      }
    } catch (err) {
      console.error('[Extensions] Failed to check for updates:', err.message);
    }
  });
}
