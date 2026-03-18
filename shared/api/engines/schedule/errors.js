/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Schedule Engine Error Class
 *
 * Base error class for schedule-related errors that can be extended
 * by specific engine implementations.
 */
export class ScheduleError extends Error {
  constructor(message, code = 'SCHEDULE_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ScheduleError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScheduleError);
    }
  }
}
