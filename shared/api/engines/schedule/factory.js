/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import cron from 'node-cron';

import { ScheduleError } from './errors';

/**
 * Schedule Manager
 * Handles registration and management of cron tasks.
 */
class ScheduleManager {
  constructor(config = {}) {
    this.tasks = new Map();
    this.autoStart = config.autoStart !== false;
    this.cleanupTimeout = config.cleanupTimeout || 5000;
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
    if (!name || typeof name !== 'string') {
      throw new ScheduleError(
        'Task name must be a non-empty string',
        'INVALID_TASK_NAME',
      );
    }

    if (!cronExpression || typeof cronExpression !== 'string') {
      throw new ScheduleError(
        'Cron expression must be a non-empty string',
        'INVALID_CRON_EXPRESSION',
      );
    }

    if (typeof handler !== 'function') {
      throw new ScheduleError('Handler must be a function', 'INVALID_HANDLER');
    }

    // Warn if overwriting existing task
    if (this.tasks.has(name)) {
      console.warn(`⚠️ Overwriting existing schedule task: ${name}`);
      this.unregister(name);
    }

    if (!cron.validate(cronExpression)) {
      throw new ScheduleError(
        `Invalid cron expression for task '${name}': ${cronExpression}`,
        'INVALID_CRON_EXPRESSION',
      );
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        const item = this.tasks.get(name);
        if (!item || item.isExecuting) {
          if (item) {
            console.warn(
              `⚠️ Skipping overlap for task '${name}' (still executing)`,
            );
          }
          return;
        }

        item.isExecuting = true;
        item.abortController = new AbortController();

        try {
          console.info(`⏱️ Running schedule task: ${name}`);
          item.activePromise = Promise.resolve(
            handler({ signal: item.abortController.signal }),
          );
          await item.activePromise;
        } catch (error) {
          console.error(`❌ Error in schedule task '${name}':`, error);
        } finally {
          item.isExecuting = false;
          item.abortController = null;
          item.activePromise = null;
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
      isExecuting: false,
      abortController: null,
      activePromise: null,
    });

    console.info(`✅ Registered schedule task: ${name} (${cronExpression})`);
    return task;
  }

  /**
   * Manually abort the currently active execution of a task.
   * This does NOT unregister the underlying cron schedule.
   *
   * @param {string} name - Task name
   * @returns {boolean} True if task execution was aborted
   */
  abort(name) {
    const item = this.tasks.get(name);
    if (item && item.isExecuting && item.abortController) {
      item.abortController.abort();
      console.info(`✅ Aborted active execution for task: ${name}`);
      return true;
    }
    return false;
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
      this.abort(name); // Abort active run if any
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
   * Check if a task's cron is currently active/scheduled
   *
   * @param {string} name - Task name
   * @returns {boolean} True if task exists and is scheduled
   */
  isTaskScheduled(name) {
    const item = this.tasks.get(name);
    return item ? item.task.getStatus() === 'scheduled' : false;
  }

  /**
   * Check if a task's logic is currently executing
   *
   * @param {string} name - Task name
   * @returns {boolean} True if task exists and is executing
   */
  isTaskExecuting(name) {
    const item = this.tasks.get(name);
    return item ? item.isExecuting : false;
  }

  /**
   * Alias for backwards compatibility maps to isTaskScheduled
   *
   * @deprecated Use isTaskScheduled or isTaskExecuting instead
   */
  isTaskRunning(name) {
    return this.isTaskScheduled(name);
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
   *
   * Note: This also sets `autoStart = false`, so tasks registered after
   * calling `stop()` will NOT auto-start unless `start()` is called again.
   */
  stop() {
    this.autoStart = false;
    this.tasks.forEach(({ task }, name) => {
      task.stop();
      console.info(`✅ Stopped schedule task: ${name}`);
    });
  }

  /**
   * Cleanup - stop and remove all tasks, aborting running ones
   * Called automatically on process termination
   */
  async cleanup() {
    console.info('🧹 Cleaning up schedule engine...');
    const activePromises = [];

    this.tasks.forEach((item, name) => {
      item.task.stop();
      if (item.isExecuting && item.abortController) {
        item.abortController.abort();
        if (item.activePromise) {
          // Add to wait array, catching errors to avoid unhandled rejections during cleanup
          activePromises.push(item.activePromise.catch(() => {}));
        }
      }
      console.info(`✅ Stopped schedule task: ${name}`);
    });

    this.tasks.clear();

    if (activePromises.length > 0) {
      console.info(
        `⏳ Waiting for ${activePromises.length} active schedule tasks to abort...`,
      );
      let timeoutTimer;
      try {
        await Promise.race([
          Promise.allSettled(activePromises),
          new Promise((_, reject) => {
            timeoutTimer = setTimeout(
              () => reject(new Error('Cleanup timeout')),
              this.cleanupTimeout,
            );
          }),
        ]);
      } catch (err) {
        console.warn(
          `⚠️ Schedule cleanup timed out after ${this.cleanupTimeout}ms`,
        );
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
      }
    }

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

  // Register cleanup on process termination signals
  schedule.onExitHandler = () => schedule.cleanup().catch(console.error);
  process.once('SIGTERM', schedule.onExitHandler);
  process.once('SIGINT', schedule.onExitHandler);

  /**
   * Destroy the instance, remove process listeners, and stop tasks
   */
  schedule.destroy = async () => {
    process.removeListener('SIGTERM', schedule.onExitHandler);
    process.removeListener('SIGINT', schedule.onExitHandler);
    await schedule.cleanup();
  };

  return schedule;
}
