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
    // Validate inputs
    if (!name || typeof name !== 'string') {
      const error = new Error('Task name must be a non-empty string');
      error.name = 'ScheduleManagerError';
      error.code = 'INVALID_TASK_NAME';
      error.status = 400;
      throw error;
    }

    if (!cronExpression || typeof cronExpression !== 'string') {
      const error = new Error('Cron expression must be a non-empty string');
      error.name = 'ScheduleManagerError';
      error.code = 'INVALID_CRON_EXPRESSION';
      error.status = 400;
      throw error;
    }

    if (typeof handler !== 'function') {
      const error = new Error('Handler must be a function');
      error.name = 'ScheduleManagerError';
      error.code = 'INVALID_HANDLER';
      error.status = 400;
      throw error;
    }

    // Warn if overwriting existing task
    if (this.tasks.has(name)) {
      console.warn(`⚠️ Overwriting existing schedule task: ${name}`);
      this.unregister(name);
    }

    try {
      if (!cron.validate(cronExpression)) {
        const error = new Error(
          `Invalid cron expression for task '${name}': ${cronExpression}`,
        );
        error.name = 'ScheduleManagerError';
        error.code = 'INVALID_CRON_EXPRESSION';
        error.status = 400;
        throw error;
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
        registeredAt: new Date().toISOString(),
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
      console.info(`✅ Stopped and unregistered schedule task: ${name}`);
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
   * Get all registered task names
   *
   * @returns {Array<string>} Array of task names
   */
  getAllTasks() {
    return Array.from(this.tasks.keys());
  }

  /**
   * Check if a task is currently running
   *
   * @param {string} name - Task name
   * @returns {boolean} True if task exists and is running
   */
  isTaskRunning(name) {
    const item = this.tasks.get(name);
    return item ? item.task.getStatus() === 'scheduled' : false;
  }

  /**
   * Get statistics about registered tasks
   *
   * @returns {Object} Task statistics
   */
  getStats() {
    const stats = {
      total: this.tasks.size,
      running: 0,
      stopped: 0,
      tasks: {},
    };

    this.tasks.forEach((item, name) => {
      const status = item.task.getStatus();
      if (status === 'scheduled') {
        stats.running++;
      } else {
        stats.stopped++;
      }

      stats.tasks[name] = {
        expression: item.expression,
        status,
        timezone: item.options.timezone || 'UTC',
        registeredAt: item.registeredAt,
      };
    });

    return stats;
  }

  /**
   * Start all tasks
   */
  start() {
    this.autoStart = true;
    this.tasks.forEach(({ task }, name) => {
      task.start();
      console.info(`✅ Started schedule task: ${name}`);
    });
  }

  /**
   * Stop all tasks
   */
  stop() {
    this.autoStart = false;
    this.tasks.forEach(({ task }, name) => {
      task.stop();
      console.info(`✅ Stopped schedule task: ${name}`);
    });
  }

  /**
   * Cleanup - stop and remove all tasks
   * Called automatically on process termination
   */
  cleanup() {
    console.info('🧹 Cleaning up schedule engine...');
    this.tasks.forEach(({ task }, name) => {
      task.stop();
      console.info(`✅ Stopped schedule task: ${name}`);
    });
    this.tasks.clear();
    console.info('✅ Schedule engine cleanup complete');
  }
}

// Export the class for direct use
export { ScheduleManager };

/**
 * Create a schedule manager instance
 *
 * @param {Object} config - Configuration options
 * @param {boolean} [config.autoStart=true] - Auto-start tasks on registration
 * @returns {ScheduleManager} Schedule manager instance
 */
export function createFactory(config = {}) {
  const schedule = new ScheduleManager(config);

  // Auto-start if not explicitly disabled
  if (config.autoStart !== false) {
    schedule.start();
  }

  // Setup process lifecycle management for cleanup
  let cleanupExecuted = false;

  const performCleanup = () => {
    if (!cleanupExecuted) {
      cleanupExecuted = true;
      schedule.cleanup();
    }
  };

  process.on('exit', performCleanup);
  process.on('SIGINT', () => {
    performCleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    performCleanup();
    process.exit(0);
  });

  return schedule;
}
