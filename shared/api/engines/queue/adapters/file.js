/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { JobNotFoundError, JobProcessingError, QueueError } from '../errors';
import { JOB_STATUS } from '../utils/constants';
import { createJob } from '../utils/createJob';
import { applyEventMixin } from '../utils/eventMixin';
import { findProcessor } from '../utils/findProcessor';

// ======================================================================
// Constants
// ======================================================================

const POLL_INTERVAL_MS = 500;
const LOCK_STALE_MS = 30000;
const DRAIN_TIMEOUT_MS = 10000;
const DRAIN_POLL_MS = 100;
const MAX_LOCK_DEPTH = 2;
const MAX_PRIORITY = 9999;
const SAFE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const STATUS_DIRS = ['pending', 'active', 'completed', 'failed', 'delayed'];

/**
 * File-Based Queue Adapter
 *
 * Persistent queue that survives process restarts. Jobs stored as JSON files
 * organized by status directories. Uses fs.promises for non-blocking I/O.
 *
 * Features:
 * - Job priority support via filename-based sorting
 * - Delayed job execution with crash recovery
 * - Job retry with exponential backoff
 * - Concurrent worker processing
 * - Multi-process safety via file locks
 * - Atomic state transitions via fs.rename()
 * - In-memory job index for O(1) lookups by ID
 */
class FileQueue {
  /**
   * @param {Object} options - Queue configuration
   * @param {string} options.name - Queue name (alphanumeric, hyphens, underscores)
   * @param {string} [options.dataDir] - Base directory for queue storage
   * @param {number} [options.concurrency=1] - Concurrent workers
   * @param {number} [options.pollInterval=500] - Poll interval in ms
   * @param {Object} [options.defaultJobOptions] - Default job options
   */
  constructor(options = {}) {
    // Validate queue name against path traversal
    const name = String(options.name || 'default').trim();
    if (!SAFE_NAME_RE.test(name)) {
      throw new QueueError(
        `Invalid queue name '${name}': alphanumeric, hyphens, underscores only`,
        'INVALID_QUEUE_NAME',
        400,
      );
    }
    this.name = name;
    this.concurrency = options.concurrency || 1;
    this.pollInterval = options.pollInterval || POLL_INTERVAL_MS;
    this.defaultJobOptions = Object.freeze({
      attempts: 3,
      backoff: 1000,
      delay: 0,
      priority: 0,
      removeOnComplete: true,
      removeOnFail: false,
      ...options.defaultJobOptions,
    });

    // Resolve and validate queue directory
    const dataDir =
      options.dataDir ||
      process.env.XNAPIFY_QUEUE_DATA_DIR ||
      path.join(
        process.env.NODE_ENV === 'production' ? os.homedir() : process.cwd(),
        '.xnapify',
        'queues',
      );
    this.queueDir = path.join(dataDir, this.name);
    this.lockDir = path.join(this.queueDir, '.locks');

    const resolved = path.resolve(this.queueDir);
    if (!resolved.startsWith(path.resolve(dataDir))) {
      throw new QueueError('Path traversal detected', 'PATH_TRAVERSAL', 400);
    }

    // Internal state
    this.processors = [];
    this.timers = new Set();
    this.pollTimer = null;
    this.isPaused = false;
    this.activeJobs = 0;

    // P01: In-memory job index for O(1) lookups
    // Maps jobId → { status, filename }
    this.jobIndex = new Map();

    // B05: Debounced meta persistence — write at most once per second
    this.metaDirty = false;
    this.metaTimer = null;

    // Stats
    this.stats = { processed: 0, failed: 0, completed: 0 };

    // Apply shared event mixin (on/off/emit)
    applyEventMixin(this);

    // Sync init — dirs must exist before any async operations
    this.ensureDirs();
    this.loadMetaSync();
    this.recoverStaleActiveSync();
    this.promoteExpiredDelayedSync();
    this.rebuildIndexSync();
  }

  // ====================================================================
  // Directory & File Helpers
  // ====================================================================

  /**
   * Create queue directory structure (sync — constructor only)
   * @private
   */
  ensureDirs() {
    for (const dir of STATUS_DIRS) {
      const dirPath = path.join(this.queueDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }
  }

  /**
   * Build filename: <invertedPriority>-<timestamp>-<jobId>.json
   * Higher priority sorts first alphabetically.
   * Priority clamped to [0, 9999] (B06).
   * @private
   */
  buildFilename(job) {
    const clamped = Math.max(0, Math.min(MAX_PRIORITY, job.priority));
    const invertedPriority = String(MAX_PRIORITY - clamped).padStart(4, '0');
    const timestamp = String(job.createdAt).padStart(15, '0');
    return `${invertedPriority}-${timestamp}-${job.id}.json`;
  }

  /**
   * Extract job ID from filename
   * @private
   */
  extractJobId(filename) {
    // Format: PPPP-TTTTTTTTTTTTTTT-<jobId>.json
    const match = filename.match(/^\d{4}-\d{15}-(.+)\.json$/);
    return match ? match[1] : null;
  }

  /**
   * Get path for a job file in a given status directory
   * @private
   */
  jobPath(status, filename) {
    return path.join(this.queueDir, status, filename);
  }

  /**
   * Write job to disk (async, atomic via tmp+rename)
   * Updates the in-memory job index.
   * @private
   */
  async writeJob(status, job) {
    const filename = this.buildFilename(job);
    const filePath = this.jobPath(status, filename);
    const tmpPath =
      filePath + `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(job), 'utf8');
    await fs.promises.rename(tmpPath, filePath);
    this.jobIndex.set(job.id, { status, filename });
    return filename;
  }

  /**
   * Read job from disk (async) with shape validation (S04)
   * @private
   */
  async readJob(status, filename) {
    const filePath = this.jobPath(status, filename);
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const job = JSON.parse(content);
      // S04: Lightweight shape validation
      if (!job || typeof job.id !== 'string' || typeof job.name !== 'string') {
        console.warn(
          `FileQueue '${this.name}': invalid job file ${filename}, skipping`,
        );
        return null;
      }
      return job;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Move job file between status directories (async, atomic on POSIX).
   * Updates the in-memory job index.
   * @private
   */
  async moveJob(fromStatus, toStatus, filename) {
    const src = this.jobPath(fromStatus, filename);
    const dest = this.jobPath(toStatus, filename);
    await fs.promises.rename(src, dest);
    const jobId = this.extractJobId(filename);
    if (jobId) {
      this.jobIndex.set(jobId, { status: toStatus, filename });
    }
  }

  /**
   * Delete a job file (async).
   * Removes from the in-memory job index.
   * @private
   */
  async deleteJob(status, filename) {
    const filePath = this.jobPath(status, filename);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const jobId = this.extractJobId(filename);
    if (jobId) {
      this.jobIndex.delete(jobId);
    }
  }

  /**
   * List job files in a status directory (async, sorted)
   * @private
   */
  async listJobs(status) {
    const dirPath = path.join(this.queueDir, status);
    try {
      const files = await fs.promises.readdir(dirPath);
      return files
        .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
        .sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  // ====================================================================
  // Job Index (P01)
  // ====================================================================

  /**
   * Rebuild the in-memory job index from disk (sync — constructor only)
   * @private
   */
  rebuildIndexSync() {
    this.jobIndex.clear();
    for (const status of STATUS_DIRS) {
      const dirPath = path.join(this.queueDir, status);
      let files;
      try {
        files = fs
          .readdirSync(dirPath)
          .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }
      for (const filename of files) {
        const jobId = this.extractJobId(filename);
        if (jobId) {
          this.jobIndex.set(jobId, { status, filename });
        }
      }
    }
  }

  // ====================================================================
  // Locking (multi-process safety)
  // ====================================================================

  /**
   * Acquire a lock on a job file (uses shared .locks/ dir).
   * B07: Capped recursion depth to prevent infinite loop.
   * @private
   */
  async acquireLock(filename, depth = 0) {
    if (depth > MAX_LOCK_DEPTH) return false;

    const lockPath = path.join(this.lockDir, filename + '.lock');
    try {
      await fs.promises.writeFile(lockPath, String(process.pid), {
        flag: 'wx',
      });
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const stat = await fs.promises.stat(lockPath);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            await fs.promises.unlink(lockPath);
            return this.acquireLock(filename, depth + 1);
          }
        } catch (statErr) {
          if (statErr.code !== 'ENOENT') {
            console.warn(
              `FileQueue '${this.name}': lock stat error:`,
              statErr.message,
            );
          }
        }
        return false;
      }
      throw err;
    }
  }

  /**
   * Release a lock
   * @private
   */
  async releaseLock(filename) {
    const lockPath = path.join(this.lockDir, filename + '.lock');
    try {
      await fs.promises.unlink(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  // ====================================================================
  // Metadata & Recovery (sync — constructor only)
  // ====================================================================

  /**
   * Load metadata from meta.json (sync — constructor)
   * @private
   */
  loadMetaSync() {
    const metaPath = path.join(this.queueDir, 'meta.json');
    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      const meta = JSON.parse(raw);
      this.stats = meta.stats || this.stats;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(
          `FileQueue '${this.name}': meta.json parse error:`,
          err.message,
        );
      }
    }
  }

  /**
   * Persist metadata to disk (async)
   * @private
   */
  async saveMeta() {
    const metaPath = path.join(this.queueDir, 'meta.json');
    const meta = { stats: this.stats, updatedAt: Date.now() };
    const tmpPath =
      metaPath + `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(meta), 'utf8');
    await fs.promises.rename(tmpPath, metaPath);
  }

  /**
   * B05: Mark meta as dirty — debounce writes to at most once per second.
   * Flushed immediately on close().
   * @private
   */
  markMetaDirty() {
    this.metaDirty = true;
    if (this.metaTimer) return;

    this.metaTimer = setTimeout(() => {
      this.metaTimer = null;
      if (this.metaDirty) {
        this.metaDirty = false;
        this.saveMeta().catch(err => {
          console.error(
            `FileQueue '${this.name}': saveMeta error:`,
            err.message,
          );
        });
      }
    }, 1000);
    this.timers.add(this.metaTimer);
  }

  /**
   * Recover jobs left in active/ from a previous crash (sync — constructor).
   * Attempts are NOT reset — the stale run consumed one attempt.
   * @private
   */
  recoverStaleActiveSync() {
    const activeDir = path.join(this.queueDir, 'active');
    let activeFiles;
    try {
      activeFiles = fs
        .readdirSync(activeDir)
        .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }

    for (const filename of activeFiles) {
      try {
        const filePath = path.join(activeDir, filename);
        const raw = fs.readFileSync(filePath, 'utf8');
        const job = JSON.parse(raw);

        job.status = JOB_STATUS.PENDING;
        job.processedAt = null;

        const pendingPath = this.jobPath('pending', filename);
        const tmpPath =
          pendingPath +
          `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(job), 'utf8');
        fs.renameSync(tmpPath, pendingPath);
        fs.unlinkSync(filePath);

        // Release stale lock
        const lockPath = path.join(this.lockDir, filename + '.lock');
        try {
          fs.unlinkSync(lockPath);
        } catch (lockErr) {
          if (lockErr.code !== 'ENOENT') throw lockErr;
        }

        console.info(
          `♻️ FileQueue '${this.name}': Recovered stale job ${job.id}`,
        );
      } catch (err) {
        console.error(
          `FileQueue '${this.name}': Recovery failed for ${filename}:`,
          err.message,
        );
      }
    }
  }

  /**
   * Promote delayed jobs whose scheduledFor has passed (sync — constructor)
   * @private
   */
  promoteExpiredDelayedSync() {
    const delayedDir = path.join(this.queueDir, 'delayed');
    let delayedFiles;
    try {
      delayedFiles = fs
        .readdirSync(delayedDir)
        .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }

    const now = Date.now();
    for (const filename of delayedFiles) {
      try {
        const filePath = path.join(delayedDir, filename);
        const raw = fs.readFileSync(filePath, 'utf8');
        const job = JSON.parse(raw);

        if (job.scheduledFor && job.scheduledFor <= now) {
          job.status = JOB_STATUS.PENDING;
          job.scheduledFor = null;

          const pendingPath = this.jobPath('pending', filename);
          const tmpPath =
            pendingPath +
            `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
          fs.writeFileSync(tmpPath, JSON.stringify(job), 'utf8');
          fs.renameSync(tmpPath, pendingPath);
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(
          `FileQueue '${this.name}': Delayed promotion failed for ${filename}:`,
          err.message,
        );
      }
    }
  }

  /**
   * Promote expired delayed jobs (async — called during polling)
   * @private
   */
  async promoteExpiredDelayed() {
    const delayedFiles = await this.listJobs('delayed');
    const now = Date.now();

    for (const filename of delayedFiles) {
      try {
        const lockAcquired = await this.acquireLock(filename);
        if (!lockAcquired) continue;

        try {
          const job = await this.readJob('delayed', filename);
          if (job && job.scheduledFor && job.scheduledFor <= now) {
            job.status = JOB_STATUS.PENDING;
            job.scheduledFor = null;
            // B11: Atomic move prevents duplicates on crash
            // Update job content in-place first, then move atomically
            const filePath = this.jobPath('delayed', filename);
            const tmpPath =
              filePath +
              `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
            await fs.promises.writeFile(tmpPath, JSON.stringify(job), 'utf8');
            await fs.promises.rename(tmpPath, filePath);
            await this.moveJob('delayed', 'pending', filename);
          }
        } finally {
          await this.releaseLock(filename);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(
            `FileQueue '${this.name}': Delayed promotion error:`,
            err.message,
          );
        }
      }
    }
  }

  // ====================================================================
  // Public API — Adapter Contract
  // ====================================================================

  /**
   * Add a job to the queue
   * @param {string} name - Job name/type
   * @param {Object} data - Job payload
   * @param {Object} options - Job-specific options
   * @returns {Promise<Object>} Job object
   */
  async add(name, data, options = {}) {
    const jobOptions = { ...this.defaultJobOptions, ...options };
    const job = createJob(name, data, this.name, jobOptions);

    const targetStatus =
      job.status === JOB_STATUS.DELAYED ? 'delayed' : 'pending';
    await this.writeJob(targetStatus, job);

    // Timer-based promotion is an optimization; polling is the crash-recovery safety net
    if (job.status === JOB_STATUS.DELAYED) {
      const timerId = setTimeout(() => {
        this.timers.delete(timerId);
        this.promoteExpiredDelayed().catch(err => {
          console.error(
            `FileQueue '${this.name}': delayed promotion error:`,
            err.message,
          );
        });
      }, jobOptions.delay);
      this.timers.add(timerId);
    }

    return job;
  }

  /**
   * Add multiple jobs
   * @param {Array} jobs - Array of {name, data, options}
   * @returns {Promise<Array>}
   */
  async addBulk(jobs) {
    const results = [];
    for (const { name, data, options } of jobs) {
      const job = await this.add(name, data, options);
      results.push(job);
    }
    return results;
  }

  /**
   * Register a job processor and start polling
   * @param {string|Function} name - Job name or processor function
   * @param {Function} [processor] - Processor function
   */
  process(name, processor) {
    if (typeof name === 'function') {
      this.processors.push({ name: '*', handler: name });
    } else {
      this.processors.push({ name, handler: processor });
    }

    if (!this.pollTimer) {
      this.startPolling();
    }
  }

  /**
   * Get a job by ID (P01: O(1) via in-memory index)
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async getJob(jobId) {
    const entry = this.jobIndex.get(jobId);
    if (!entry) throw new JobNotFoundError(jobId);

    const job = await this.readJob(entry.status, entry.filename);
    if (!job) {
      // Index is stale — remove and throw
      this.jobIndex.delete(jobId);
      throw new JobNotFoundError(jobId);
    }
    return job;
  }

  /**
   * Get all jobs by status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getJobsByStatus(status) {
    const files = await this.listJobs(status);
    const jobs = [];
    for (const f of files) {
      const job = await this.readJob(status, f);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  /**
   * Get all jobs
   * @returns {Promise<Array>}
   */
  async getJobs() {
    const all = [];
    for (const status of STATUS_DIRS) {
      const files = await this.listJobs(status);
      for (const filename of files) {
        const job = await this.readJob(status, filename);
        if (job) all.push(job);
      }
    }
    return all;
  }

  /**
   * Remove a job by ID
   * @param {string} jobId
   * @returns {Promise<boolean>}
   */
  async removeJob(jobId) {
    // Try index first for O(1) lookup
    const entry = this.jobIndex.get(jobId);
    if (entry) {
      await this.deleteJob(entry.status, entry.filename);
      return true;
    }

    // Fallback: full scan (index might be stale after external modification)
    const suffix = `-${jobId}.json`;
    for (const status of STATUS_DIRS) {
      const files = await this.listJobs(status);
      for (const filename of files) {
        if (filename.endsWith(suffix)) {
          await this.deleteJob(status, filename);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Retry a failed job — move back to pending/
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async retryJob(jobId) {
    const entry = this.jobIndex.get(jobId);
    if (!entry || entry.status !== 'failed') {
      // Fallback: scan failed dir
      const suffix = `-${jobId}.json`;
      const failedFiles = await this.listJobs('failed');
      for (const filename of failedFiles) {
        if (filename.endsWith(suffix)) {
          return this.retryJobByFile(jobId, filename);
        }
      }
      throw new JobNotFoundError(jobId);
    }
    return this.retryJobByFile(jobId, entry.filename);
  }

  /**
   * Internal: retry a job given its filename in failed/
   * @private
   */
  async retryJobByFile(jobId, filename) {
    const job = await this.readJob('failed', filename);
    if (!job) throw new JobNotFoundError(jobId);
    if (job.status !== JOB_STATUS.FAILED) {
      throw new JobProcessingError(jobId, 'Only failed jobs can be retried');
    }

    job.status = JOB_STATUS.PENDING;
    job.attempts = 0;
    job.error = null;
    job.failedAt = null;

    await this.writeJob('pending', job);
    await this.deleteJob('failed', filename);
    return job;
  }

  /**
   * Pause the queue
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume the queue and trigger immediate processing
   */
  resume() {
    this.isPaused = false;
    this.processNext().catch(err => {
      console.error(
        `FileQueue '${this.name}': processNext error:`,
        err.message,
      );
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
   * Remove all pending jobs
   * @returns {Promise<void>}
   */
  async empty() {
    const files = await this.listJobs('pending');
    for (const filename of files) {
      await this.deleteJob('pending', filename);
    }
  }

  /**
   * Clean completed/failed jobs older than grace period
   * @param {string} status - 'completed', 'failed', or 'all'
   * @param {number} grace - Grace period in ms
   * @returns {Promise<number>}
   */
  async clean(status = 'completed', grace = 0) {
    const cutoff = Date.now() - grace;
    let cleaned = 0;
    const statuses = status === 'all' ? ['completed', 'failed'] : [status];

    for (const s of statuses) {
      const files = await this.listJobs(s);
      for (const filename of files) {
        const job = await this.readJob(s, filename);
        if (!job) continue;

        const jobTime = job.completedAt || job.failedAt;
        if (jobTime && jobTime < cutoff) {
          await this.deleteJob(s, filename);
          cleaned++;
        }
      }
    }
    return cleaned;
  }

  /**
   * Close the queue — drain active jobs, stop polling, clear timers
   * @returns {Promise<void>}
   */
  async close() {
    this.isPaused = true;

    // Drain: wait for active jobs to finish (with timeout)
    const start = Date.now();
    while (this.activeJobs > 0 && Date.now() - start < DRAIN_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_MS));
    }

    if (this.activeJobs > 0) {
      console.warn(
        `FileQueue '${this.name}': ${this.activeJobs} jobs still active after drain timeout`,
      );
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // B05: Clear debounce timer
    if (this.metaTimer) {
      clearTimeout(this.metaTimer);
      this.metaTimer = null;
    }

    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    this.processors = [];

    // Flush dirty meta on close
    await this.saveMeta();
    this.metaDirty = false;
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    // Derive counts from in-memory index (O(n) scan, no disk I/O)
    const counts = {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    for (const entry of this.jobIndex.values()) {
      if (counts[entry.status] !== undefined) {
        counts[entry.status]++;
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

  // ====================================================================
  // Internal Processing
  // ====================================================================

  /**
   * Start polling for pending jobs
   * @private
   */
  startPolling() {
    this.pollTimer = setInterval(() => {
      // Promote expired delayed jobs each cycle (crash recovery safety net)
      this.promoteExpiredDelayed().catch(err => {
        console.error(
          `FileQueue '${this.name}': delayed promotion error:`,
          err.message,
        );
      });

      if (!this.isPaused && this.activeJobs < this.concurrency) {
        this.processNext().catch(err => {
          console.error(
            `FileQueue '${this.name}': processNext error:`,
            err.message,
          );
        });
      }
    }, this.pollInterval);
  }

  /**
   * Find and process the next pending job
   * @private
   */
  async processNext() {
    if (this.isPaused || this.activeJobs >= this.concurrency) return;

    const pendingFiles = await this.listJobs('pending');
    if (pendingFiles.length === 0) return;

    const filename = pendingFiles[0];

    // STEP 1: Acquire lock BEFORE moving (multi-process safety)
    const lockAcquired = await this.acquireLock(filename);
    if (!lockAcquired) return;

    // STEP 2: Atomic claim — move to active/
    try {
      await this.moveJob('pending', 'active', filename);
    } catch (err) {
      await this.releaseLock(filename);
      if (err.code === 'ENOENT') return;
      throw err;
    }

    // STEP 3: Read from active/ (we own it now)
    const job = await this.readJob('active', filename);
    if (!job) {
      await this.deleteJob('active', filename);
      await this.releaseLock(filename);
      return;
    }

    const processor = findProcessor(job.name, this.processors);
    if (!processor) {
      // No processor — move back to pending
      try {
        await this.moveJob('active', 'pending', filename);
      } catch (moveErr) {
        console.warn(
          `FileQueue '${this.name}': move-back failed:`,
          moveErr.message,
        );
      }
      await this.releaseLock(filename);
      return;
    }

    // B02: Update job state AND persist to disk before processing
    job.status = JOB_STATUS.ACTIVE;
    job.processedAt = Date.now();
    job.attempts++;
    // Persist so crash recovery sees the incremented attempt count
    await this.writeJob('active', job);
    this.activeJobs++;

    this.emit('active', job);

    try {
      const jobContext = {
        ...job,
        updateProgress: progress => {
          job.progress = progress;
          this.emit('progress', job, progress);
        },
      };

      const result = await processor.handler(jobContext);

      // Completed
      job.status = JOB_STATUS.COMPLETED;
      job.result = result;
      job.completedAt = Date.now();
      job.progress = 100;

      this.stats.completed++;
      this.stats.processed++;

      this.emit('completed', job, result);

      if (job.removeOnComplete) {
        await this.deleteJob('active', filename);
      } else {
        // B05: write-then-delete order is intentional (at-least-once > at-most-once).
        // If crash occurs between write and delete, job appears in both dirs;
        // this is safer than losing it entirely.
        await this.writeJob('completed', job);
        await this.deleteJob('active', filename);
      }
    } catch (error) {
      job.error = { message: error.message, stack: error.stack };

      if (job.attempts < job.maxAttempts) {
        const backoffDelay = job.backoff * Math.pow(2, job.attempts - 1);
        job.status = JOB_STATUS.DELAYED;
        job.scheduledFor = Date.now() + backoffDelay;

        await this.writeJob('delayed', job);
        await this.deleteJob('active', filename);

        const timerId = setTimeout(() => {
          this.timers.delete(timerId);
          this.promoteExpiredDelayed().catch(err => {
            console.error(
              `FileQueue '${this.name}': delayed promotion error:`,
              err.message,
            );
          });
        }, backoffDelay);
        this.timers.add(timerId);
      } else {
        job.status = JOB_STATUS.FAILED;
        job.failedAt = Date.now();
        this.stats.failed++;
        this.stats.processed++;

        this.emit('failed', job, error);

        if (job.removeOnFail) {
          await this.deleteJob('active', filename);
        } else {
          await this.writeJob('failed', job);
          await this.deleteJob('active', filename);
        }
      }
    } finally {
      this.activeJobs--;
      await this.releaseLock(filename);
      // B05: Debounced meta persistence instead of writing every job
      this.markMetaDirty();
      // B04: Eagerly pick up next job instead of waiting for poll
      setImmediate(() => {
        this.processNext().catch(err => {
          console.error(
            `FileQueue '${this.name}': processNext error:`,
            err.message,
          );
        });
      });
    }
  }
}

export default FileQueue;
