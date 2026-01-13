/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ScheduleManager from './manager';

/**
 * Create a schedule manager instance
 *
 * @returns {ScheduleManager} Schedule manager instance
 */
export function createFactory(config = {}) {
  const schedule = new ScheduleManager(config);
  if (config.autoStart !== false) {
    schedule.start();
  }
  return schedule;
}
