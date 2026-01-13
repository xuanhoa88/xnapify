/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import cron from 'node-cron';

/**
 * Schedule Manager
 * Handles registration and management of cron tasks.
 */
class ScheduleManager {
  constructor(config = {}) {
    this.tasks = new Map();
    this.autoStart = config.autoStart !== false;
  }

  /**
   * Register a new cron task
   *
   * @param {string} name - Unique name for the task
   * @param {string} cronExpression - Cron expression (e.g., '* * * * *')
   * @param {Function} handler - Function to execute
   * @param {Object} [options] - Options for the task
   * @param {boolean} [options.scheduled=true] - Whether to auto-start the task
   * @param {string} [options.timezone] - Timezone for execution
   * @returns {Object} The scheduled task instance
   */
  register(name, cronExpression, handler, options = {}) {
    if (this.tasks.has(name)) {
      console.warn(`⚠️ Overwriting existing schedule task: ${name}`);
      this.unregister(name);
    }

    try {
      if (!cron.validate(cronExpression)) {
        throw new Error(
          `Invalid cron expression for task '${name}': ${cronExpression}`,
        );
      }

      const task = cron.schedule(
        cronExpression,
        async () => {
          try {
            console.info(`⏱️ Running schedule task: ${name}`);
            await handler();
          } catch (error) {
            console.error(`❌ Error in schedule task '${name}':`, error);
          }
        },
        {
          scheduled:
            options.scheduled !== undefined
              ? options.scheduled
              : this.autoStart !== false,
          timezone: options.timezone || 'UTC',
        },
      );

      this.tasks.set(name, {
        task,
        expression: cronExpression,
        options,
      });

      console.info(`✅ Registered schedule task: ${name} (${cronExpression})`);
      return task;
    } catch (error) {
      console.error(`❌ Failed to register schedule task '${name}':`, error);
      throw error;
    }
  }

  /**
   * Unregister (stop and remove) a task
   *
   * @param {string} name - Task name
   * @returns {boolean} True if task was found and removed
   */
  unregister(name) {
    const item = this.tasks.get(name);
    if (item) {
      item.task.stop();
      this.tasks.delete(name);
      console.info(`Stopped and unregistered schedule task: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get a registered task info
   *
   * @param {string} name - Task name
   * @returns {Object|undefined} Task info or undefined
   */
  get(name) {
    return this.tasks.get(name);
  }

  /**
   * Start all tasks
   */
  start() {
    this.autoStart = true;
    this.tasks.forEach(({ task }, name) => {
      task.start();
      console.info(`Started schedule task: ${name}`);
    });
  }

  /**
   * Stop all tasks
   */
  stop() {
    this.autoStart = false;
    this.tasks.forEach(({ task }, name) => {
      task.stop();
      console.info(`Stopped schedule task: ${name}`);
    });
  }
}

export default ScheduleManager;
