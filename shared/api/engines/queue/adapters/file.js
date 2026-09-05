/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import { getDataDir } from '@shared/utils/env.js';

import { JobNotFoundError, JobProcessingError, QueueError } from '../errors.js';
import { JOB_STATUS } from '../utils/constants.js';
import { createJob } from '../utils/createJob.js';
import { applyEventMixin } from '../utils/eventMixin.js';
import { findProcessor } from '../utils/findProcessor.js';

// ======================================================================
// Constants
// ======================================================================

const POLL_INTERVAL_MS = 500;
const LOCK_STALE_MS = 30_000;
const MIN_HEARTBEAT_MS = 250;
const DRAIN_TIMEOUT_MS = 10_000;
const DRAIN_POLL_MS = 100;
const MAX_LOCK_DEPTH = 2;
const MAX_PRIORITY = 9999;
const SAFE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const STATUS_DIRS = ['pending', 'active', 'completed', 'failed', 'delayed'];

/**
 * Unique temp-file suffix so concurrent writers never collide.
 * @private
 */
function tmpSuffix() {
  return `-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
}

/**
 * File-Based Queue Adapter
 *
 * Persistent queue that survives process restarts. Jobs are stored as JSON
 * files organised by status directory. All state transitions are atomic
 * `fs.rename()` calls, so a crash at any point leaves at most one extra copy
 * of a job (at-least-once delivery), never a lost job.
 *
 * Concurrency model:
 * - In-process: a slot is reserved *before* the first `await` of a claim, so
 *   overlapping `processNext()` calls can never exceed `concurrency`.
 * - Cross-process: the pending → active rename is the claim. Only one process
 *   can win the rename; losers see ENOENT and move on to the next candidate.
 * - Per-job lock files in `.locks/` carry ownership. The owner refreshes the
 *   lock mtime on a heartbeat while the job runs. A lock older than
 *   `lockStaleMs` is treated as abandoned and may be stolen — the steal is a
 *   rename, so two stealers cannot both succeed.
 * - Jobs left in `active/` whose lock is stale or missing are moved back to
 *   `pending/` on boot and on every poll tick. Jobs with a live lock
 *   (another process still working) are left alone.
 *
 * Handlers must not block the event loop for longer than `lockStaleMs`, or
 * a sibling process may legitimately conclude the job was abandoned.
 */
class FileQueue {
  /**
   * @param {Object} options - Queue configuration
   * @param {string} options.name - Queue name (alphanumeric, hyphens, underscores)
   * @param {string} [options.dataDir] - Base directory for queue storage
   * @param {number} [options.concurrency=1] - Concurrent workers
   * @param {number} [options.pollInterval=500] - Poll interval in ms
   * @param {number} [options.lockStaleMs=30000] - Lock age after which a job is considered abandoned
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
    this.concurrency = Math.max(1, options.concurrency || 1);
    this.pollInterval = options.pollInterval || POLL_INTERVAL_MS;
    this.lockStaleMs = options.lockStaleMs || LOCK_STALE_MS;
    this.heartbeatMs = Math.max(
      MIN_HEARTBEAT_MS,
      Math.floor(this.lockStaleMs / 3),
    );
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
    const dataDir = options.dataDir
      ? path.resolve(options.dataDir)
      : process.env.XNAPIFY_QUEUE_DATA_DIR
        ? path.resolve(process.env.XNAPIFY_QUEUE_DATA_DIR)
        : getDataDir('queues');
    this.queueDir = path.join(dataDir, this.name);
    this.lockDir = path.join(this.queueDir, '.locks');

    const resolved = path.resolve(this.queueDir);
    if (!resolved.startsWith(path.resolve(dataDir))) {
      throw new QueueError('Path traversal detected', 'PATH_TRAVERSAL', 400);
    }

    // Processing state
    this.processors = [];
    this.timers = new Set();
    this.pollTimer = null;
    this.isPaused = false;
    this.closed = false;
    this.ticking = false;

    // Slot accounting. `activeJobs` counts running handlers; `claiming`
    // counts in-flight claim attempts that have reserved a slot but not yet
    // moved a file. Both count against `concurrency`.
    this.activeJobs = 0;
    this.claiming = 0;

    // Filenames currently being processed by THIS process. Recovery skips
    // these even if their lock heartbeat is somehow behind.
    this.owned = new Set();
    this.heartbeats = new Map();

    // In-memory job index for O(1) lookups: jobId → { status, filename }
    this.jobIndex = new Map();

    // Debounced meta persistence — write at most once per second
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
      fs.mkdirSync(path.join(this.queueDir, dir), { recursive: true });
    }
    fs.mkdirSync(this.lockDir, { recursive: true });
  }

  /**
   * Build filename: <invertedPriority>-<timestamp>-<jobId>.json
   * Higher priority sorts first alphabetically.
   * @private
   */
  buildFilename(job) {
    const priority = Number.isFinite(job.priority) ? job.priority : 0;
    const clamped = Math.max(0, Math.min(MAX_PRIORITY, priority));
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
   * Get path for a job's lock file
   * @private
   */
  lockPath(filename) {
    return path.join(this.lockDir, filename + '.lock');
  }

  /**
   * Write job to disk (async, atomic via tmp+rename).
   * Updates the in-memory job index.
   * @private
   */
  async writeJob(status, job) {
    const filename = this.buildFilename(job);
    const filePath = this.jobPath(status, filename);
    const tmpPath = filePath + tmpSuffix();
    await fs.promises.writeFile(tmpPath, JSON.stringify(job), 'utf8');
    await fs.promises.rename(tmpPath, filePath);
    this.jobIndex.set(job.id, { status, filename });
    return filename;
  }

  /**
   * Write job to disk synchronously (constructor recovery only).
   * @private
   */
  writeJobSync(status, job, filename) {
    const filePath = this.jobPath(status, filename);
    const tmpPath = filePath + tmpSuffix();
    fs.writeFileSync(tmpPath, JSON.stringify(job), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  /**
   * Read job from disk (async) with shape validation
   * @private
   */
  async readJob(status, filename) {
    const filePath = this.jobPath(status, filename);
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const job = JSON.parse(content);
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
   * Move job file between status directories (async, atomic).
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
   * Only drops the index entry if the index still points at this status,
   * so write-then-delete transitions leave the index pointing at the new
   * location instead of losing the job.
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
      const entry = this.jobIndex.get(jobId);
      if (entry && entry.status === status) {
        this.jobIndex.delete(jobId);
      }
    }
  }

  /**
   * Transition a job to a new status with updated content.
   * Writes the new copy first, then removes the old one, so a crash in
   * between leaves a duplicate (recovered as at-least-once) rather than
   * losing the job.
   * @private
   */
  async transitionJob(fromStatus, toStatus, job, filename) {
    await this.writeJob(toStatus, job);
    await this.deleteJob(fromStatus, filename);
  }

  /**
   * List job files in a status directory (async, sorted)
   * @private
   */
  async listJobs(status) {
    const dirPath = path.join(this.queueDir, status);
    try {
      const files = await fs.promises.readdir(dirPath);
      return files.filter(f => f.endsWith('.json')).sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * List job files synchronously (constructor only)
   * @private
   */
  listJobsSync(status) {
    const dirPath = path.join(this.queueDir, status);
    try {
      return fs
        .readdirSync(dirPath)
        .filter(f => f.endsWith('.json'))
        .sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * Locate a job on disk by ID, consulting the index first and falling
   * back to a directory scan (jobs written by other processes are not in
   * this process's index). Refreshes the index on a hit.
   * @private
   * @returns {Promise<{status: string, filename: string}|null>}
   */
  async locateJob(jobId) {
    const entry = this.jobIndex.get(jobId);
    if (entry) {
      try {
        await fs.promises.access(this.jobPath(entry.status, entry.filename));
        return entry;
      } catch {
        this.jobIndex.delete(jobId);
      }
    }

    const suffix = `-${jobId}.json`;
    for (const status of STATUS_DIRS) {
      const files = await this.listJobs(status);
      const filename = files.find(f => f.endsWith(suffix));
      if (filename) {
        const found = { status, filename };
        this.jobIndex.set(jobId, found);
        return found;
      }
    }
    return null;
  }

  // ====================================================================
  // Job Index
  // ====================================================================

  /**
   * Rebuild the in-memory job index from disk (sync — constructor only)
   * @private
   */
  rebuildIndexSync() {
    this.jobIndex.clear();
    for (const status of STATUS_DIRS) {
      for (const filename of this.listJobsSync(status)) {
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
   * Whether a lock file exists and was refreshed within `lockStaleMs`.
   * @private
   */
  async isLockFresh(filename) {
    try {
      const stat = await fs.promises.stat(this.lockPath(filename));
      return Date.now() - stat.mtimeMs <= this.lockStaleMs;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  /**
   * Sync variant for constructor-time recovery.
   * @private
   */
  isLockFreshSync(filename) {
    try {
      const stat = fs.statSync(this.lockPath(filename));
      return Date.now() - stat.mtimeMs <= this.lockStaleMs;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  /**
   * Acquire a lock on a job file (exclusive create in `.locks/`).
   *
   * A stale lock is stolen by renaming it to a unique name first. Rename is
   * atomic, so if two processes race to steal the same lock exactly one
   * rename succeeds; the loser retries and finds the winner's fresh lock.
   * @private
   */
  async acquireLock(filename, depth = 0) {
    if (depth > MAX_LOCK_DEPTH) return false;

    const lockPath = this.lockPath(filename);
    try {
      await fs.promises.writeFile(lockPath, String(process.pid), {
        flag: 'wx',
      });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Lock exists — is it abandoned?
    let stale = false;
    try {
      const stat = await fs.promises.stat(lockPath);
      stale = Date.now() - stat.mtimeMs > this.lockStaleMs;
    } catch (statErr) {
      // Vanished between create and stat — owner released it; try again.
      if (statErr.code === 'ENOENT')
        return this.acquireLock(filename, depth + 1);
      console.warn(
        `FileQueue '${this.name}': lock stat error:`,
        statErr.message,
      );
      return false;
    }
    if (!stale) return false;

    // Steal via atomic rename so only one process can claim the stale lock.
    const stealPath = `${lockPath}${tmpSuffix()}.stale`;
    try {
      await fs.promises.rename(lockPath, stealPath);
    } catch (renameErr) {
      if (renameErr.code === 'ENOENT') {
        return this.acquireLock(filename, depth + 1);
      }
      throw renameErr;
    }
    await fs.promises.unlink(stealPath).catch(() => {});
    return this.acquireLock(filename, depth + 1);
  }

  /**
   * Release a lock
   * @private
   */
  async releaseLock(filename) {
    try {
      await fs.promises.unlink(this.lockPath(filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /**
   * Try to take a lock synchronously (constructor recovery only).
   * Steals stale locks; never waits.
   * @private
   */
  acquireLockSync(filename) {
    const lockPath = this.lockPath(filename);
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    if (this.isLockFreshSync(filename)) return false;

    const stealPath = `${lockPath}${tmpSuffix()}.stale`;
    try {
      fs.renameSync(lockPath, stealPath);
      fs.unlinkSync(stealPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') return false;
      throw err;
    }
  }

  /**
   * @private
   */
  releaseLockSync(filename) {
    try {
      fs.unlinkSync(this.lockPath(filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /**
   * Keep a lock fresh while its job runs so sibling processes never mistake
   * a long-running job for an abandoned one.
   * @private
   */
  startHeartbeat(filename) {
    const lockPath = this.lockPath(filename);
    const beat = () => {
      const now = new Date();
      fs.promises.utimes(lockPath, now, now).catch(err => {
        if (err.code === 'ENOENT') {
          // Someone removed our lock; re-assert ownership.
          return fs.promises
            .writeFile(lockPath, String(process.pid))
            .catch(() => {});
        }
        return undefined;
      });
    };
    const id = setInterval(beat, this.heartbeatMs);
    this.heartbeats.set(filename, id);
  }

  /**
   * @private
   */
  stopHeartbeat(filename) {
    const id = this.heartbeats.get(filename);
    if (id) {
      clearInterval(id);
      this.heartbeats.delete(filename);
    }
  }

  // ====================================================================
  // Metadata & Recovery
  // ====================================================================

  /**
   * Load metadata from meta.json (sync — constructor)
   * @private
   */
  loadMetaSync() {
    const metaPath = path.join(this.queueDir, 'meta.json');
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
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
   * Persist metadata to disk (async, atomic)
   * @private
   */
  async saveMeta() {
    const metaPath = path.join(this.queueDir, 'meta.json');
    const meta = { stats: this.stats, updatedAt: Date.now() };
    const tmpPath = metaPath + tmpSuffix();
    await fs.promises.writeFile(tmpPath, JSON.stringify(meta), 'utf8');
    await fs.promises.rename(tmpPath, metaPath);
  }

  /**
   * Mark meta as dirty — debounce writes to at most once per second.
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
   * Recover jobs left in active/ by a dead process (sync — constructor).
   * Jobs whose lock is still fresh belong to a live sibling and are skipped;
   * the poll tick will re-check them once the lock goes stale.
   * Attempts are NOT reset — the stale run consumed one attempt.
   * @private
   */
  recoverStaleActiveSync() {
    for (const filename of this.listJobsSync('active')) {
      if (this.isLockFreshSync(filename)) continue;
      if (!this.acquireLockSync(filename)) continue;
      try {
        const activePath = this.jobPath('active', filename);
        const job = JSON.parse(fs.readFileSync(activePath, 'utf8'));
        job.status = JOB_STATUS.PENDING;
        job.processedAt = null;
        this.writeJobSync('active', job, filename);
        fs.renameSync(activePath, this.jobPath('pending', filename));
        console.info(
          `♻️ FileQueue '${this.name}': Recovered stale job ${job.id}`,
        );
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(
            `FileQueue '${this.name}': Recovery failed for ${filename}:`,
            err.message,
          );
        }
      } finally {
        this.releaseLockSync(filename);
      }
    }
  }

  /**
   * Recover abandoned active jobs (async — every poll tick).
   * Same rules as the sync variant, plus: never touch a job this process
   * is running itself.
   * @private
   */
  async recoverStaleActive() {
    const activeFiles = await this.listJobs('active');
    for (const filename of activeFiles) {
      if (this.owned.has(filename)) continue;
      try {
        if (await this.isLockFresh(filename)) continue;
        if (!(await this.acquireLock(filename))) continue;
        try {
          // Re-check after taking the lock: a claim may have raced us.
          if (this.owned.has(filename)) continue;
          const job = await this.readJob('active', filename);
          if (!job) continue;
          job.status = JOB_STATUS.PENDING;
          job.processedAt = null;
          await this.writeJob('active', job);
          await this.moveJob('active', 'pending', filename);
          console.info(
            `♻️ FileQueue '${this.name}': Recovered stale job ${job.id}`,
          );
        } finally {
          await this.releaseLock(filename);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(
            `FileQueue '${this.name}': Recovery error for ${filename}:`,
            err.message,
          );
        }
      }
    }
  }

  /**
   * Promote delayed jobs whose scheduledFor has passed (sync — constructor)
   * @private
   */
  promoteExpiredDelayedSync() {
    const now = Date.now();
    for (const filename of this.listJobsSync('delayed')) {
      if (!this.acquireLockSync(filename)) continue;
      try {
        const delayedPath = this.jobPath('delayed', filename);
        const job = JSON.parse(fs.readFileSync(delayedPath, 'utf8'));
        if (job.scheduledFor && job.scheduledFor <= now) {
          job.status = JOB_STATUS.PENDING;
          job.scheduledFor = null;
          this.writeJobSync('delayed', job, filename);
          fs.renameSync(delayedPath, this.jobPath('pending', filename));
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(
            `FileQueue '${this.name}': Delayed promotion failed for ${filename}:`,
            err.message,
          );
        }
      } finally {
        this.releaseLockSync(filename);
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
        if (!(await this.acquireLock(filename))) continue;
        try {
          const job = await this.readJob('delayed', filename);
          if (job && job.scheduledFor && job.scheduledFor <= now) {
            job.status = JOB_STATUS.PENDING;
            job.scheduledFor = null;
            // Update content in place, then move atomically
            await this.writeJob('delayed', job);
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

  /**
   * Schedule a one-shot delayed promotion (optimisation — polling is the
   * crash-recovery safety net).
   * @private
   */
  scheduleDelayedPromotion(delay) {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      this.promoteExpiredDelayed()
        .then(() => this.fillSlots())
        .catch(err => {
          console.error(
            `FileQueue '${this.name}': delayed promotion error:`,
            err.message,
          );
        });
    }, delay);
    this.timers.add(timerId);
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

    if (job.status === JOB_STATUS.DELAYED) {
      await this.writeJob('delayed', job);
      this.scheduleDelayedPromotion(jobOptions.delay);
    } else {
      await this.writeJob('pending', job);
      // Wake the worker now instead of waiting for the next poll
      this.scheduleFill();
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
      results.push(await this.add(name, data, options));
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

    if (!this.pollTimer && !this.closed) {
      this.startPolling();
    }
  }

  /**
   * Get a job by ID (index first, disk scan fallback)
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async getJob(jobId) {
    const entry = await this.locateJob(jobId);
    if (!entry) throw new JobNotFoundError(jobId);

    const job = await this.readJob(entry.status, entry.filename);
    if (!job) {
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
      all.push(...(await this.getJobsByStatus(status)));
    }
    return all;
  }

  /**
   * Remove a job by ID
   * @param {string} jobId
   * @returns {Promise<boolean>}
   */
  async removeJob(jobId) {
    const entry = await this.locateJob(jobId);
    if (!entry) return false;
    await this.deleteJob(entry.status, entry.filename);
    this.jobIndex.delete(jobId);
    return true;
  }

  /**
   * Retry a failed job — move back to pending/
   * @param {string} jobId
   * @returns {Promise<Object>}
   */
  async retryJob(jobId) {
    const entry = await this.locateJob(jobId);
    if (!entry) throw new JobNotFoundError(jobId);
    if (entry.status !== 'failed') {
      throw new JobProcessingError(jobId, 'Only failed jobs can be retried');
    }

    const job = await this.readJob('failed', entry.filename);
    if (!job) throw new JobNotFoundError(jobId);
    if (job.status !== JOB_STATUS.FAILED) {
      throw new JobProcessingError(jobId, 'Only failed jobs can be retried');
    }

    job.status = JOB_STATUS.PENDING;
    job.attempts = 0;
    job.error = null;
    job.failedAt = null;

    await this.transitionJob('failed', 'pending', job, entry.filename);
    this.scheduleFill();
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
    this.fillSlots().catch(err => {
      console.error(`FileQueue '${this.name}': fillSlots error:`, err.message);
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
    for (const filename of await this.listJobs('pending')) {
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
      for (const filename of await this.listJobs(s)) {
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
   * Close the queue — stop claiming, drain running jobs, clear timers.
   * Jobs still running after the drain timeout stay in active/ with a
   * lock that goes stale, so the next boot recovers them.
   * @returns {Promise<void>}
   */
  async close() {
    this.closed = true;
    this.isPaused = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Drain: wait for running jobs and in-flight claims to settle
    const start = Date.now();
    while (
      this.activeJobs + this.claiming > 0 &&
      Date.now() - start < DRAIN_TIMEOUT_MS
    ) {
      await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_MS));
    }

    if (this.activeJobs > 0) {
      console.warn(
        `FileQueue '${this.name}': ${this.activeJobs} jobs still active after drain timeout`,
      );
    }

    if (this.metaTimer) {
      clearTimeout(this.metaTimer);
      this.metaTimer = null;
    }
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    for (const filename of Array.from(this.heartbeats.keys())) {
      this.stopHeartbeat(filename);
    }
    this.processors = [];

    await this.saveMeta();
    this.metaDirty = false;
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
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
   * Start the poll loop. The first tick runs immediately so recovered and
   * already-pending jobs don't wait a full interval.
   * @private
   */
  startPolling() {
    this.pollTimer = setInterval(() => this.tick(), this.pollInterval);
    this.tick();
  }

  /**
   * One poll cycle: recover abandoned jobs, promote due delayed jobs, then
   * fill free slots. Re-entrancy guarded so slow ticks never overlap.
   * @private
   */
  tick() {
    if (this.ticking || this.closed) return;
    this.ticking = true;
    (async () => {
      try {
        await this.recoverStaleActive();
        await this.promoteExpiredDelayed();
        await this.fillSlots();
      } catch (err) {
        console.error(`FileQueue '${this.name}': tick error:`, err.message);
      } finally {
        this.ticking = false;
      }
    })();
  }

  /**
   * Whether a new claim may start right now.
   * @private
   */
  canClaim() {
    return (
      !this.isPaused &&
      !this.closed &&
      this.processors.length > 0 &&
      this.activeJobs + this.claiming < this.concurrency
    );
  }

  /**
   * Fill free worker slots on the next macrotask.
   * @private
   */
  scheduleFill() {
    if (this.closed || !this.pollTimer) return;
    setImmediate(() => {
      this.fillSlots().catch(err => {
        console.error(
          `FileQueue '${this.name}': fillSlots error:`,
          err.message,
        );
      });
    });
  }

  /**
   * Claim and start jobs until slots are full or pending/ is empty.
   * Safe to call concurrently — slot reservation is synchronous.
   * @private
   */
  async fillSlots() {
    while (await this.processNext()) {
      // keep claiming
    }
  }

  /**
   * Reserve a slot, claim one pending job, and start it in the background.
   * @private
   * @returns {Promise<boolean>} True if a job was started
   */
  async processNext() {
    if (!this.canClaim()) return false;

    // Reserve BEFORE the first await so overlapping callers can't all pass
    // the concurrency check and over-subscribe the worker pool.
    this.claiming++;
    let claim = null;
    try {
      claim = await this.claimNext();
      if (claim) {
        this.activeJobs++;
        this.owned.add(claim.filename);
      }
    } finally {
      this.claiming--;
    }

    if (!claim) return false;

    this.runJob(claim.job, claim.filename).catch(err => {
      console.error(`FileQueue '${this.name}': runJob error:`, err.message);
    });
    return true;
  }

  /**
   * Walk pending/ in priority order and atomically claim the first job we
   * can lock and rename. Files another process grabs first are skipped.
   * @private
   * @returns {Promise<{job: Object, filename: string}|null>}
   */
  async claimNext() {
    const pendingFiles = await this.listJobs('pending');

    for (const filename of pendingFiles) {
      if (this.closed || this.isPaused) return null;

      // STEP 1: Lock — ownership marker for siblings and recovery
      if (!(await this.acquireLock(filename))) continue;

      // STEP 2: Atomic claim — exactly one process wins this rename
      try {
        await this.moveJob('pending', 'active', filename);
      } catch (err) {
        await this.releaseLock(filename);
        if (err.code === 'ENOENT') continue;
        throw err;
      }

      // STEP 3: Read from active/ (we own it now)
      const job = await this.readJob('active', filename);
      if (!job) {
        await this.deleteJob('active', filename);
        await this.releaseLock(filename);
        continue;
      }

      const processor = findProcessor(job.name, this.processors);
      if (!processor) {
        // Nobody can run this — put it back and stop scanning
        try {
          await this.moveJob('active', 'pending', filename);
        } catch (moveErr) {
          console.warn(
            `FileQueue '${this.name}': move-back failed:`,
            moveErr.message,
          );
        }
        await this.releaseLock(filename);
        return null;
      }

      // STEP 4: Persist the attempt before running so a crash mid-handler
      // is counted against maxAttempts on recovery
      job.status = JOB_STATUS.ACTIVE;
      job.processedAt = Date.now();
      job.attempts++;
      await this.writeJob('active', job);

      return { job, filename, processor };
    }

    return null;
  }

  /**
   * Run a claimed job to completion, failure, or retry.
   * @private
   */
  async runJob(job, filename) {
    const processor = findProcessor(job.name, this.processors);
    this.startHeartbeat(filename);
    this.emit('active', job);

    try {
      if (!processor) {
        throw new Error(`No processor registered for '${job.name}'`);
      }

      const jobContext = {
        ...job,
        updateProgress: progress => {
          job.progress = progress;
          this.emit('progress', job, progress);
        },
      };

      const result = await processor.handler(jobContext);

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
        await this.transitionJob('active', 'completed', job, filename);
      }
    } catch (error) {
      job.error = { message: error.message, stack: error.stack };

      if (job.attempts < job.maxAttempts) {
        const backoffDelay = job.backoff * Math.pow(2, job.attempts - 1);
        job.status = JOB_STATUS.DELAYED;
        job.scheduledFor = Date.now() + backoffDelay;

        await this.transitionJob('active', 'delayed', job, filename);
        this.scheduleDelayedPromotion(backoffDelay);
      } else {
        job.status = JOB_STATUS.FAILED;
        job.failedAt = Date.now();
        this.stats.failed++;
        this.stats.processed++;

        this.emit('failed', job, error);

        if (job.removeOnFail) {
          await this.deleteJob('active', filename);
        } else {
          await this.transitionJob('active', 'failed', job, filename);
        }
      }
    } finally {
      this.stopHeartbeat(filename);
      this.owned.delete(filename);
      this.activeJobs--;
      await this.releaseLock(filename);
      this.markMetaDirty();
      // Eagerly pick up the next job instead of waiting for the poll
      this.scheduleFill();
    }
  }
}

export default FileQueue;
