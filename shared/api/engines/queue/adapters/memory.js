/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { JobNotFoundError, JobProcessingError } from '../errors';
import { JOB_STATUS } from '../utils/constants';
import { createJob } from '../utils/create-job';
import { applyEventMixin } from '../utils/event-mixin';
import { findProcessor } from '../utils/find-processor';

/**
 * Memory Queue Adapter
 *
 * In-memory queue implementation for development and single-instance deployments.
 * Jobs are stored in memory and will be lost on process restart.
 *
 * Features:
 * - Job priority support
 * - Delayed job execution
 * - Job retry with exponential backoff
 * - Concurrent worker processing
 * - Job lifecycle hooks (onComplete, onFailed)
 */
class MemoryQueue {
  /**
   * @param {Object} options - Queue configuration
   * @param {string} options.name - Queue name
   * @param {number} [options.concurrency=1] - Number of concurrent workers
   * @param {number} [options.defaultJobOptions.attempts=3] - Default retry attempts
   * @param {number} [options.defaultJobOptions.backoff=1000] - Default backoff in ms
   * @param {number} [options.defaultJobOptions.delay=0] - Default delay in ms
   * @param {number} [options.defaultJobOptions.priority=0] - Default priority (higher = first)
   */
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.concurrency = options.concurrency || 1;
    this.defaultJobOptions = Object.freeze({
      attempts: 3,
      backoff: 1000,
      delay: 0,
      priority: 0,
      removeOnComplete: true,
      removeOnFail: false,
      ...options.defaultJobOptions,
    });

    // Internal state
    this.jobs = new Map();
    this.processors = [];
    this.timers = new Set();
    this.isProcessing = false;
    this.isPaused = false;
    this.activeJobs = 0;

    // Stats
    this.stats = {
      processed: 0,
      failed: 0,
      completed: 0,
    };

    // Apply shared event mixin (on/off/emit)
    applyEventMixin(this);
  }

  /**
   * Add a job to the queue
   * @param {string} name - Job name/type
   * @param {Object} data - Job payload data
   * @param {Object} options - Job-specific options
   * @returns {Promise<Object>} Job object
   */
  async add(name, data, options = {}) {
    const jobOptions = { ...this.defaultJobOptions, ...options };
    const job = createJob(name, data, this.name, jobOptions);

    this.jobs.set(job.id, job);

    // Schedule delayed job
    if (job.status === JOB_STATUS.DELAYED) {
      const timerId = setTimeout(() => {
        this.timers.delete(timerId);
        const delayedJob = this.jobs.get(job.id);
        if (delayedJob && delayedJob.status === JOB_STATUS.DELAYED) {
          delayedJob.status = JOB_STATUS.PENDING;
          delayedJob.scheduledFor = null;
          this.processNext().catch(err => {
            console.error(
              `Queue '${this.name}': processNext error:`,
              err.message,
            );
          });
        }
      }, jobOptions.delay);
      this.timers.add(timerId);
    }

    // Trigger processing
    this.processNext().catch(err => {
      console.error(`Queue '${this.name}': processNext error:`, err.message);
    });

    return job;
  }

  /**
   * Add multiple jobs to the queue
   * @param {Array} jobs - Array of {name, data, options} objects
   * @returns {Promise<Array>} Array of job objects
   */
  async addBulk(jobs) {
    const results = [];
    for (const { name, data, options } of jobs) {
      const jobOptions = { ...this.defaultJobOptions, ...options };
      const job = createJob(name, data, this.name, jobOptions);
      this.jobs.set(job.id, job);

      // Schedule delayed job timer (but don't trigger processNext yet)
      if (job.status === JOB_STATUS.DELAYED) {
        const timerId = setTimeout(() => {
          this.timers.delete(timerId);
          const delayedJob = this.jobs.get(job.id);
          if (delayedJob && delayedJob.status === JOB_STATUS.DELAYED) {
            delayedJob.status = JOB_STATUS.PENDING;
            delayedJob.scheduledFor = null;
            this.processNext().catch(err => {
              console.error(
                `Queue '${this.name}': processNext error:`,
                err.message,
              );
            });
          }
        }, jobOptions.delay);
        this.timers.add(timerId);
      }

      results.push(job);
    }

    // B09: Single processNext after all jobs are added
    this.processNext().catch(err => {
      console.error(`Queue '${this.name}': processNext error:`, err.message);
    });
    return results;
  }

  /**
   * Register a job processor
   * @param {string|Function} name - Job name or processor function
   * @param {Function} processor - Processor function (if name provided)
   */
  process(name, processor) {
    // Handle single processor for all jobs
    if (typeof name === 'function') {
      this.processors.push({ name: '*', handler: name });
    } else {
      this.processors.push({ name, handler: processor });
    }

    // Start processing if not already running
    this.processNext().catch(err => {
      console.error(`Queue '${this.name}': processNext error:`, err.message);
    });
  }

  /**
   * Process next available job
   * @private
   */
  async processNext() {
    // Check if we can process more jobs
    if (this.isPaused || this.activeJobs >= this.concurrency) {
      return;
    }

    // Find next pending job (sorted by priority, then by creation time)
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === JOB_STATUS.PENDING)
      .sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      });

    if (pendingJobs.length === 0) {
      return;
    }

    const job = pendingJobs[0];
    const processor = findProcessor(job.name, this.processors);

    if (!processor) {
      return;
    }

    // Mark job as active
    job.status = JOB_STATUS.ACTIVE;
    job.processedAt = Date.now();
    job.attempts++;
    this.activeJobs++;

    // Emit active event
    this.emit('active', job);

    try {
      // Create job context with progress reporting
      const jobContext = {
        ...job,
        updateProgress: progress => {
          job.progress = progress;
          this.emit('progress', job, progress);
        },
      };

      // Execute processor
      const result = await processor.handler(jobContext);

      // Job completed
      job.status = JOB_STATUS.COMPLETED;
      job.result = result;
      job.completedAt = Date.now();
      job.progress = 100;

      this.stats.completed++;
      this.stats.processed++;

      // Emit completed event
      this.emit('completed', job, result);

      // Remove if configured
      if (job.removeOnComplete) {
        this.jobs.delete(job.id);
      }
    } catch (error) {
      // Handle job failure
      job.error = {
        message: error.message,
        stack: error.stack,
      };

      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const backoffDelay = job.backoff * Math.pow(2, job.attempts - 1);
        job.status = JOB_STATUS.DELAYED;
        job.scheduledFor = Date.now() + backoffDelay;

        const timerId = setTimeout(() => {
          this.timers.delete(timerId);
          const retryJob = this.jobs.get(job.id);
          if (retryJob && retryJob.status === JOB_STATUS.DELAYED) {
            retryJob.status = JOB_STATUS.PENDING;
            retryJob.scheduledFor = null;
            this.processNext().catch(err => {
              console.error(
                `Queue '${this.name}': processNext error:`,
                err.message,
              );
            });
          }
        }, backoffDelay);
        this.timers.add(timerId);
      } else {
        // Max attempts reached
        job.status = JOB_STATUS.FAILED;
        job.failedAt = Date.now();
        this.stats.failed++;
        this.stats.processed++;

        // Emit failed event
        this.emit('failed', job, error);

        // Remove if configured
        if (job.removeOnFail) {
          this.jobs.delete(job.id);
        }
      }
    } finally {
      this.activeJobs--;
      // B01 fix: break recursion with setImmediate to avoid stack overflow
      setImmediate(() => {
        this.processNext().catch(err => {
          console.error(
            `Queue '${this.name}': processNext error:`,
            err.message,
          );
        });
      });
    }
  }

  /**
   * Get a job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job object
   */
  async getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new JobNotFoundError(jobId);
    }
    return job;
  }

  /**
   * Get jobs by status
   * @param {string} status - Job status
   * @returns {Promise<Array>} Array of jobs
   */
  async getJobsByStatus(status) {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Get all jobs
   * @returns {Promise<Array>} Array of all jobs
   */
  async getJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Remove a job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} True if removed
   */
  async removeJob(jobId) {
    return this.jobs.delete(jobId);
  }

  /**
   * Retry a failed job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Updated job
   */
  async retryJob(jobId) {
    const job = await this.getJob(jobId);
    if (job.status !== JOB_STATUS.FAILED) {
      throw new JobProcessingError(jobId, 'Only failed jobs can be retried');
    }

    job.status = JOB_STATUS.PENDING;
    job.attempts = 0;
    job.error = null;
    job.failedAt = null;

    this.processNext().catch(err => {
      console.error(`Queue '${this.name}': processNext error:`, err.message);
    });
    return job;
  }

  /**
   * Pause the queue
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume the queue
   */
  resume() {
    this.isPaused = false;
    this.processNext().catch(err => {
      console.error(`Queue '${this.name}': processNext error:`, err.message);
    });
  }

  /**
   * Check if queue is paused
   * @returns {boolean}
   */
  isPausedState() {
    return this.isPaused;
  }

  /**
   * Empty the queue (remove all pending jobs)
   * @returns {Promise<void>}
   */
  async empty() {
    const pendingIds = [];
    for (const [id, job] of this.jobs) {
      if (job.status === JOB_STATUS.PENDING) pendingIds.push(id);
    }
    for (const id of pendingIds) {
      this.jobs.delete(id);
    }
  }

  /**
   * Clean completed/failed jobs
   * @param {string} status - Status to clean ('completed', 'failed', or 'all')
   * @param {number} grace - Only clean jobs older than grace period (ms)
   * @returns {Promise<number>} Number of jobs cleaned
   */
  async clean(status = 'completed', grace = 0) {
    const cutoff = Date.now() - grace;
    let cleaned = 0;

    for (const [id, job] of this.jobs.entries()) {
      const shouldClean =
        status === 'all'
          ? job.status === JOB_STATUS.COMPLETED ||
            job.status === JOB_STATUS.FAILED
          : job.status === status;

      if (shouldClean) {
        const jobTime = job.completedAt || job.failedAt;
        if (jobTime && jobTime < cutoff) {
          this.jobs.delete(id);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Close the queue
   * @returns {Promise<void>}
   */
  async close() {
    this.isPaused = true;
    this.processors = [];
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    this.jobs.clear();
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    const counts = {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
    for (const job of this.jobs.values()) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }

    return {
      name: this.name,
      concurrency: this.concurrency,
      isPaused: this.isPaused,
      activeJobs: this.activeJobs,
      counts,
      stats: { ...this.stats },
    };
  }
}

export default MemoryQueue;
