/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Worker Handler - Performs asynchronous database writes for activities
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Handle LOG_ACTIVITY request
 *
 * Worker handlers receive a SINGLE data argument from the caller.
 * The caller must include `models` in the payload.
 *
 * @param {Object} data - Activity data including models reference
 * @param {Object} data.models - Sequelize models
 * @param {string} data.event - Event name
 * @param {string} data.entity_type - Entity type
 * @param {string} [data.entity_id] - Entity ID
 * @param {string} [data.actor_id] - Actor ID
 * @param {Object} [data.data] - Additional metadata
 */
async function logActivity({ models, ...payload }) {
  const { Activity } = models;

  try {
    const activity = await Activity.create({
      id: uuidv4(),
      ...payload,
      created_at: new Date(),
    });

    return { success: true, activityId: activity.id };
  } catch (error) {
    console.error('[ActivityWorker] Failed to write log:', error.message);
    return { success: false, error: error.message };
  }
}

export default logActivity;
