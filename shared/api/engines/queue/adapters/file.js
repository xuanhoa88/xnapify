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
// A lock must be refreshed at least three times inside its staleness window,
// so anything below this makes the heartbeat slower than the steal threshold.
const MIN_LOCK_STALE_MS = MIN_HEARTBEAT_MS * 3;
const DRAIN_TIMEOUT_MS = 10_000;
const DRAIN_POLL_MS = 100;
const MAX_LOCK_DEPTH = 2;
const MAX_PRIORITY = 9999;
const SAFE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const STATUS_DIRS = ['pending', 'active', 'completed', 'failed', 'delayed'];
// Unparseable / malformed job files are moved here instead of being deleted.
const CORRUPT_DIR = 'corrupt';
// Retention + housekeeping defaults (override per queue via `options`).
const MAINTENANCE_INTERVAL_MS = 5 * 60_000;
const COMPLETED_RETENTION_MS = 24 * 60 * 60_000;
const FAILED_RETENTION_MS = 7 * 24 * 60 * 60_000;
// Leftover `.tmp` / `.stale` artifacts older than this are swept.
const ARTIFACT_GRACE_MS = 60_000;

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
 * files organised by status directory. Each write goes to a temp file that is
 * fsynced (unless `fsync: false`) and then renamed into place, with the
 * containing directory fsynced after, so an interrupted transition leaves at
 * most one extra copy of a job (at-least-once delivery) rather than a
 * truncated or missing one.
 *
 * Concurrency model:
 * - In-process: a slot is reserved *before* the first `await` of a claim, so
 *   overlapping `processNext()` calls can never exceed `concurrency`.
 * - Cross-process: the pending → active rename is the claim. Only one process
 *   can win the rename; losers see ENOENT and move on to the next candidate.
 * - Per-job lock files in `.locks/` carry ownership. Each acquisition stamps a
 *   unique owner token, and the owner refreshes the lock mtime on a heartbeat
 *   while the job runs. A lock older than `lockStaleMs` is treated as
 *   abandoned and may be stolen — the steal is a rename, so two stealers
 *   cannot both succeed. Release and heartbeat verify the token first, so a
 *   worker whose lock was stolen never deletes or refreshes its successor's.
 * - Jobs left in `active/` whose lock is stale or missing are moved back to
 *   `pending/` on boot and on every poll tick, unless they have already used
 *   every attempt — those are dead-lettered to `failed/`, so a job that
 *   hard-crashes its worker cannot be replayed forever. Jobs with a live lock
 *   (another process still working) are left alone.
 * - A job file that cannot be parsed or is missing `id`/`name` is moved to
 *   `corrupt/` and logged; it is never deleted.
 *
 * Housekeeping (while processing): `.tmp`/`.stale` crash artifacts are swept
 * and terminal jobs older than `retention.completed` / `retention.failed` are
 * removed, every `maintenanceInterval`.
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
   * @param {number} [options.lockStaleMs=30000] - Lock age after which a job is
   *   considered abandoned. Clamped up to 750ms (three heartbeats) — below
   *   that a lock would expire before its own heartbeat could refresh it.
   * @param {number} [options.drainTimeout=10000] - How long close() waits for
   *   running jobs. Jobs outliving it keep their locks heartbeated.
   * @param {Object} [options.retention] - Terminal-job retention in ms.
   * @param {number|null} [options.retention.completed=86400000] - Age after
   *   which completed jobs are removed; null/Infinity disables.
   * @param {number|null} [options.retention.failed=604800000] - Age after
   *   which failed jobs are removed; null/Infinity disables.
   * @param {number} [options.maintenanceInterval=300000] - Housekeeping period
   * @param {boolean} [options.fsync=true] - Flush each job write (and its
   *   directory) to stable storage before returning. Disable only where
   *   losing recently written jobs to a host crash is acceptable; it trades
   *   the durability guarantee for a large throughput win.
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

    // A lock is refreshed every `lockStaleMs / 3`, but never faster than
    // MIN_HEARTBEAT_MS. Anything below MIN_LOCK_STALE_MS would therefore be
    // declared stale before its own heartbeat could refresh it, silently
    // disabling the anti-steal guarantee — clamp and warn instead.
    const requestedStaleMs = options.lockStaleMs || LOCK_STALE_MS;
    if (requestedStaleMs < MIN_LOCK_STALE_MS) {
      console.warn(
        `FileQueue '${name}': lockStaleMs ${requestedStaleMs}ms is below the ` +
          `${MIN_LOCK_STALE_MS}ms minimum (heartbeat is ${MIN_HEARTBEAT_MS}ms); clamping`,
      );
    }
    this.lockStaleMs = Math.max(MIN_LOCK_STALE_MS, requestedStaleMs);
    this.heartbeatMs = Math.max(
      MIN_HEARTBEAT_MS,
      Math.floor(this.lockStaleMs / 3),
    );
    this.drainTimeout = Number.isFinite(options.drainTimeout)
      ? Math.max(0, options.drainTimeout)
      : DRAIN_TIMEOUT_MS;

    // Flush job writes to stable storage before the rename. On by default:
    // without it a host (not process) crash can leave the renamed file
    // truncated or the rename unrecorded, i.e. a genuinely lost job.
    this.fsync = options.fsync !== false;

    // Retention policy for terminal jobs. `null` disables a bucket.
    const retention = options.retention || {};
    this.retention = {
      completed:
        retention.completed === undefined
          ? COMPLETED_RETENTION_MS
          : retention.completed,
      failed:
        retention.failed === undefined ? FAILED_RETENTION_MS : retention.failed,
    };
    this.maintenanceInterval =
      Number.isFinite(options.maintenanceInterval) &&
      options.maintenanceInterval > 0
        ? options.maintenanceInterval
        : MAINTENANCE_INTERVAL_MS;
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
    this.corruptDir = path.join(this.queueDir, CORRUPT_DIR);

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

    // Lock ownership. A pid alone cannot distinguish "my lock" from "a lock
    // created at the same path after mine was stolen", so every acquisition
    // stamps a unique token that release/heartbeat verify before touching the
    // lock file.
    this.ownerId = `${process.pid}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`;
    this.lockSeq = 0;
    this.lockTokens = new Map();

    // In-memory job index for O(1) lookups: jobId → { status, filename }
    this.jobIndex = new Map();

    // delayed/ due-ness cache: filename → { mtimeMs, scheduledFor }. Lets the
    // poll tick skip locking and reading jobs that are not due yet.
    this.delayedSchedule = new Map();

    // Debounced meta persistence — write at most once per second
    this.metaDirty = false;
    this.metaTimer = null;
    this.maintenanceTimer = null;

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
    fs.mkdirSync(this.corruptDir, { recursive: true });
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
   * Best-effort fsync of a directory so a rename into it survives a host
   * crash. Some platforms/filesystems refuse to open a directory for sync;
   * the file contents were already flushed, so failures are ignored.
   * @private
   */
  async fsyncDir(dirPath) {
    let handle = null;
    try {
      handle = await fs.promises.open(dirPath, 'r');
      await handle.sync();
    } catch {
      // Directory fsync unsupported here — nothing else to do.
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }

  /**
   * Sync variant of {@link fsyncDir} (constructor-time recovery only).
   * @private
   */
  fsyncDirSync(dirPath) {
    let fd = null;
    try {
      fd = fs.openSync(dirPath, 'r');
      fs.fsyncSync(fd);
    } catch {
      // Directory fsync unsupported here — nothing else to do.
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Already closed.
        }
      }
    }
  }

  /**
   * Atomically replace `filePath` via a unique temp file plus rename.
   *
   * With `durable`, the temp file is fsynced before the rename and the
   * containing directory after it. Without those two flushes a host crash (as
   * opposed to a process crash) can leave the renamed file truncated or the
   * rename itself unrecorded — i.e. a genuinely lost job, which the
   * at-least-once contract does not allow.
   * @private
   */
  async writeFileAtomic(filePath, content, { durable = false } = {}) {
    const tmpPath = filePath + tmpSuffix();
    if (durable) {
      let handle = null;
      try {
        handle = await fs.promises.open(tmpPath, 'w');
        await handle.writeFile(content, 'utf8');
        await handle.sync();
      } finally {
        if (handle) await handle.close();
      }
    } else {
      await fs.promises.writeFile(tmpPath, content, 'utf8');
    }

    try {
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      throw err;
    }
    if (durable) await this.fsyncDir(path.dirname(filePath));
  }

  /**
   * Sync variant of {@link writeFileAtomic}.
   * @private
   */
  writeFileAtomicSync(filePath, content, { durable = false } = {}) {
    const tmpPath = filePath + tmpSuffix();
    if (durable) {
      const fd = fs.openSync(tmpPath, 'w');
      try {
        fs.writeFileSync(fd, content, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    } else {
      fs.writeFileSync(tmpPath, content, 'utf8');
    }

    try {
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Already gone.
      }
      throw err;
    }
    if (durable) this.fsyncDirSync(path.dirname(filePath));
  }

  /**
   * Write job to disk (async, atomic + durable via tmp+fsync+rename).
   * Updates the in-memory job index.
   * @private
   */
  async writeJob(status, job) {
    const filename = this.buildFilename(job);
    const filePath = this.jobPath(status, filename);
    await this.writeFileAtomic(filePath, JSON.stringify(job), {
      durable: this.fsync,
    });
    this.jobIndex.set(job.id, { status, filename });
    return filename;
  }

  /**
   * Write job to disk synchronously (constructor recovery only).
   * @private
   */
  writeJobSync(status, job, filename) {
    this.writeFileAtomicSync(
      this.jobPath(status, filename),
      JSON.stringify(job),
      { durable: this.fsync },
    );
  }

  /**
   * Quarantine a job file that cannot be interpreted.
   *
   * Deleting it would destroy work (a torn write from a host crash looks
   * exactly like garbage), so the file is moved to `corrupt/` for an operator
   * to inspect and an error is logged.
   * @private
   */
  async quarantineJob(status, filename, reason) {
    const dest = path.join(
      this.corruptDir,
      `${Date.now()}-${status}-${filename}`,
    );
    try {
      await fs.promises.mkdir(this.corruptDir, { recursive: true });
      await fs.promises.rename(this.jobPath(status, filename), dest);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(
          `FileQueue '${this.name}': quarantine failed for ${status}/${filename}:`,
          err.message,
        );
      }
      return;
    }
    console.error(
      `FileQueue '${this.name}': quarantined ${status}/${filename} (${reason}) → ${dest}`,
    );
    const jobId = this.extractJobId(filename);
    if (jobId) {
      const entry = this.jobIndex.get(jobId);
      if (entry && entry.status === status) {
        this.jobIndex.delete(jobId);
      }
    }
  }

  /**
   * Sync variant of {@link quarantineJob} (constructor recovery only).
   * @private
   */
  quarantineJobSync(status, filename, reason) {
    const dest = path.join(
      this.corruptDir,
      `${Date.now()}-${status}-${filename}`,
    );
    try {
      fs.mkdirSync(this.corruptDir, { recursive: true });
      fs.renameSync(this.jobPath(status, filename), dest);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(
          `FileQueue '${this.name}': quarantine failed for ${status}/${filename}:`,
          err.message,
        );
      }
      return;
    }
    console.error(
      `FileQueue '${this.name}': quarantined ${status}/${filename} (${reason}) → ${dest}`,
    );
  }

  /**
   * Read job from disk (async) with shape validation.
   * Returns null when the file is gone; an unreadable file is quarantined
   * (never deleted) and also reported as null.
   * @private
   */
  async readJob(status, filename) {
    const filePath = this.jobPath(status, filename);
    let content;
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }

    let job;
    try {
      job = JSON.parse(content);
    } catch (err) {
      await this.quarantineJob(
        status,
        filename,
        `unparseable JSON: ${err.message}`,
      );
      return null;
    }
    if (!job || typeof job.id !== 'string' || typeof job.name !== 'string') {
      await this.quarantineJob(status, filename, 'missing id/name');
      return null;
    }
    return job;
  }

  /**
   * Sync variant of {@link readJob} (constructor recovery only).
   * @private
   */
  readJobSync(status, filename) {
    let content;
    try {
      content = fs.readFileSync(this.jobPath(status, filename), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }

    let job;
    try {
      job = JSON.parse(content);
    } catch (err) {
      this.quarantineJobSync(
        status,
        filename,
        `unparseable JSON: ${err.message}`,
      );
      return null;
    }
    if (!job || typeof job.id !== 'string' || typeof job.name !== 'string') {
      this.quarantineJobSync(status, filename, 'missing id/name');
      return null;
    }
    return job;
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
    const token = this.nextLockToken();
    try {
      await fs.promises.writeFile(lockPath, token, { flag: 'wx' });
      this.lockTokens.set(filename, token);
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
   * Mint a token that identifies one specific lock acquisition by this
   * instance. Two acquisitions of the same path never share a token, so a
   * stolen-and-recreated lock is always distinguishable from our own.
   * @private
   */
  nextLockToken() {
    this.lockSeq += 1;
    return `${this.ownerId}:${this.lockSeq}`;
  }

  /**
   * Whether the lock file at `filename` still carries `token`.
   * @private
   */
  async ownsLock(filename, token) {
    try {
      const content = await fs.promises.readFile(
        this.lockPath(filename),
        'utf8',
      );
      return content === token;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  /**
   * Release a lock we still own.
   *
   * A no-op when this instance never held the lock or when the file now
   * carries someone else's token: a stalled worker waking up after its lock
   * went stale must not delete the lock its successor is relying on.
   * @private
   */
  async releaseLock(filename) {
    const token = this.lockTokens.get(filename);
    this.lockTokens.delete(filename);
    if (!token) return;

    if (!(await this.ownsLock(filename, token))) {
      console.warn(
        `FileQueue '${this.name}': lock for ${filename} is no longer ours; not releasing`,
      );
      return;
    }
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
    let token = this.nextLockToken();
    try {
      fs.writeFileSync(lockPath, token, { flag: 'wx' });
      this.lockTokens.set(filename, token);
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
    token = this.nextLockToken();
    try {
      fs.writeFileSync(lockPath, token, { flag: 'wx' });
      this.lockTokens.set(filename, token);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') return false;
      throw err;
    }
  }

  /**
   * Sync variant of {@link releaseLock} — also ownership-checked.
   * @private
   */
  releaseLockSync(filename) {
    const token = this.lockTokens.get(filename);
    this.lockTokens.delete(filename);
    if (!token) return;

    try {
      if (fs.readFileSync(this.lockPath(filename), 'utf8') !== token) {
        console.warn(
          `FileQueue '${this.name}': lock for ${filename} is no longer ours; not releasing`,
        );
        return;
      }
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
    const token = this.lockTokens.get(filename);

    const lost = reason => {
      console.warn(
        `FileQueue '${this.name}': lock for ${filename} ${reason}; stopping heartbeat`,
      );
      this.lockTokens.delete(filename);
      this.stopHeartbeat(filename);
    };

    const beat = async () => {
      if (!token) return;
      let content;
      try {
        content = await fs.promises.readFile(lockPath, 'utf8');
      } catch (err) {
        if (err.code !== 'ENOENT') return;
        // Our lock vanished. Re-assert it exclusively so we never clobber a
        // lock a different owner legitimately created in the meantime.
        try {
          await fs.promises.writeFile(lockPath, token, { flag: 'wx' });
        } catch (writeErr) {
          if (writeErr.code === 'EEXIST')
            lost('was taken over by another owner');
        }
        return;
      }
      if (content !== token) {
        lost('was taken over by another owner');
        return;
      }
      const now = new Date();
      await fs.promises.utimes(lockPath, now, now).catch(() => {});
    };

    const id = setInterval(() => {
      beat().catch(() => {});
    }, this.heartbeatMs);
    // Never hold the event loop open: after close() a heartbeat may outlive
    // the drain window (see close()), but it must not prevent process exit.
    if (typeof id.unref === 'function') id.unref();
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
    // Counters only — never fsynced, losing them costs nothing but stats.
    await this.writeFileAtomic(metaPath, JSON.stringify(meta));
  }

  /**
   * Mark meta as dirty — debounce writes to at most once per second.
   * Flushed immediately on close().
   * @private
   */
  markMetaDirty() {
    this.metaDirty = true;
    if (this.metaTimer) return;

    const timerId = setTimeout(() => {
      // Drop the timer from the tracking set — otherwise `timers` grows by one
      // entry per active second until close().
      this.timers.delete(timerId);
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
    this.metaTimer = timerId;
    this.timers.add(timerId);
  }

  /**
   * Recover jobs left in active/ by a dead process (sync — constructor).
   * Jobs whose lock is still fresh belong to a live sibling and are skipped;
   * the poll tick will re-check them once the lock goes stale.
   * Attempts are NOT reset — the stale run consumed one attempt.
   * @private
   */
  /**
   * Whether a job has already burned every attempt it is allowed.
   *
   * `attempts` is incremented before the handler runs, so a job whose worker
   * died mid-handler comes back with the attempt already counted. Without
   * this ceiling a job that hard-crashes the process (OOM, segfault) is
   * replayed forever, taking the worker down on every boot.
   * @private
   */
  isAttemptsExhausted(job) {
    const max = Number(job.maxAttempts);
    if (!Number.isFinite(max) || max <= 0) return false;
    return (Number(job.attempts) || 0) >= max;
  }

  /**
   * Build the error recorded on a job whose worker died while running it.
   * @private
   */
  abandonedError(job) {
    return {
      message: `Job abandoned after ${Number(job.attempts) || 0} attempt(s): the worker died while processing it`,
      stack: null,
    };
  }

  /**
   * Dead-letter a crash-failed job whose attempts are exhausted (async).
   * Mirrors the throw-failure path in runJob().
   * @private
   */
  async failAbandonedJob(job, filename) {
    job.status = JOB_STATUS.FAILED;
    job.processedAt = null;
    job.failedAt = Date.now();
    job.error = this.abandonedError(job);

    this.stats.failed++;
    this.stats.processed++;

    console.error(
      `☠️ FileQueue '${this.name}': job ${job.id} exhausted maxAttempts while abandoned → failed`,
    );
    this.emit('failed', job, new Error(job.error.message));

    if (job.removeOnFail) {
      await this.deleteJob('active', filename);
    } else {
      await this.transitionJob('active', 'failed', job, filename);
    }
    this.markMetaDirty();
  }

  /**
   * Sync variant of {@link failAbandonedJob} (constructor recovery only).
   * @private
   */
  failAbandonedJobSync(job, filename) {
    job.status = JOB_STATUS.FAILED;
    job.processedAt = null;
    job.failedAt = Date.now();
    job.error = this.abandonedError(job);

    this.stats.failed++;
    this.stats.processed++;

    if (!job.removeOnFail) {
      this.writeJobSync('failed', job, filename);
    }
    try {
      fs.unlinkSync(this.jobPath('active', filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    console.error(
      `☠️ FileQueue '${this.name}': job ${job.id} exhausted maxAttempts while abandoned → failed`,
    );
  }

  recoverStaleActiveSync() {
    for (const filename of this.listJobsSync('active')) {
      if (this.isLockFreshSync(filename)) continue;
      if (!this.acquireLockSync(filename)) continue;
      try {
        const job = this.readJobSync('active', filename);
        if (!job) continue;
        if (this.isAttemptsExhausted(job)) {
          this.failAbandonedJobSync(job, filename);
          continue;
        }
        const activePath = this.jobPath('active', filename);
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
          if (this.isAttemptsExhausted(job)) {
            await this.failAbandonedJob(job, filename);
            continue;
          }
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
        const job = this.readJobSync('delayed', filename);
        if (job && job.scheduledFor && job.scheduledFor <= now) {
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

    // Forget cache entries for files that left delayed/.
    if (this.delayedSchedule.size) {
      const present = new Set(delayedFiles);
      for (const key of this.delayedSchedule.keys()) {
        if (!present.has(key)) this.delayedSchedule.delete(key);
      }
    }

    for (const filename of delayedFiles) {
      try {
        // Cheap due-ness check FIRST: one stat validates the cached
        // scheduledFor. Locking and reading every not-yet-due job on every
        // poll tick costs ~6 syscalls/second/job for nothing.
        const scheduledFor = await this.readScheduledFor(filename);
        if (!scheduledFor || scheduledFor > now) continue;

        if (!(await this.acquireLock(filename))) continue;
        try {
          // Re-read under the lock: another process may have moved it.
          const job = await this.readJob('delayed', filename);
          if (job && job.scheduledFor && job.scheduledFor <= now) {
            job.status = JOB_STATUS.PENDING;
            job.scheduledFor = null;
            // Update content in place, then move atomically
            await this.writeJob('delayed', job);
            await this.moveJob('delayed', 'pending', filename);
            this.delayedSchedule.delete(filename);
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
   * `scheduledFor` of a delayed job, cached against the file's mtime so a
   * not-yet-due job costs a single `stat()` per poll tick instead of a lock
   * round-trip plus a full read.
   * @private
   * @returns {Promise<number|null>}
   */
  async readScheduledFor(filename) {
    let mtimeMs;
    try {
      ({ mtimeMs } = await fs.promises.stat(this.jobPath('delayed', filename)));
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.delayedSchedule.delete(filename);
        return null;
      }
      throw err;
    }

    const cached = this.delayedSchedule.get(filename);
    if (cached && cached.mtimeMs === mtimeMs) return cached.scheduledFor;

    const job = await this.readJob('delayed', filename);
    const scheduledFor = job && job.scheduledFor ? job.scheduledFor : null;
    this.delayedSchedule.set(filename, { mtimeMs, scheduledFor });
    return scheduledFor;
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
      Date.now() - start < this.drainTimeout
    ) {
      await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_MS));
    }

    if (this.activeJobs > 0) {
      console.warn(
        `FileQueue '${this.name}': ${this.activeJobs} jobs still active after drain timeout; ` +
          'their locks stay heartbeated until they finish',
      );
    }

    if (this.metaTimer) {
      clearTimeout(this.metaTimer);
      this.metaTimer = null;
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    for (const filename of Array.from(this.heartbeats.keys())) {
      // A handler that outlived the drain window is still real work. Killing
      // its heartbeat lets its lock go stale, and a sibling would re-queue
      // and run it concurrently — the exact race the heartbeat prevents.
      // Heartbeat intervals are unref'd, so they never block process exit;
      // runJob()'s finally stops each one when its job actually finishes.
      if (this.owned.has(filename)) continue;
      this.stopHeartbeat(filename);
    }
    this.processors = [];

    await this.saveMeta();
    this.metaDirty = false;
  }

  /**
   * Get queue statistics.
   *
   * `counts` is read from disk, so it reflects every process sharing the data
   * directory. `activeJobs` and `stats` are this process's own view.
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

    for (const status of STATUS_DIRS) {
      counts[status] = (await this.listJobs(status)).length;
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
    if (!this.maintenanceTimer) {
      this.maintenanceTimer = setInterval(() => {
        this.maintenance().catch(err => {
          console.error(
            `FileQueue '${this.name}': maintenance error:`,
            err.message,
          );
        });
      }, this.maintenanceInterval);
      if (typeof this.maintenanceTimer.unref === 'function') {
        this.maintenanceTimer.unref();
      }
    }
    this.tick();
  }

  /**
   * Periodic housekeeping so a long-lived worker's data dir stays bounded:
   * sweep crash artifacts, then apply the retention policy to terminal jobs.
   * @private
   */
  async maintenance() {
    if (this.closed) return;
    await this.sweepArtifacts();
    await this.applyRetention();
  }

  /**
   * Delete orphaned `*.tmp` write scratch files and `*.stale` lock-steal
   * artifacts left behind by crashed processes. Only files older than
   * ARTIFACT_GRACE_MS are touched, so in-flight writes are never disturbed.
   * @private
   * @returns {Promise<number>} Number of artifacts removed
   */
  async sweepArtifacts() {
    const cutoff = Date.now() - ARTIFACT_GRACE_MS;
    const dirs = [
      this.queueDir,
      this.lockDir,
      ...STATUS_DIRS.map(status => path.join(this.queueDir, status)),
    ];

    let removed = 0;
    for (const dir of dirs) {
      let entries;
      try {
        entries = await fs.promises.readdir(dir);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }
      for (const entry of entries) {
        if (!entry.endsWith('.tmp') && !entry.endsWith('.stale')) continue;
        const target = path.join(dir, entry);
        try {
          const stat = await fs.promises.stat(target);
          if (stat.mtimeMs > cutoff) continue;
          await fs.promises.unlink(target);
          removed++;
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.warn(
              `FileQueue '${this.name}': sweep failed for ${target}:`,
              err.message,
            );
          }
        }
      }
    }
    return removed;
  }

  /**
   * Drop terminal jobs older than the configured retention window.
   * `removeOnFail` defaults to false, so without this failed/ would grow
   * without bound for the life of the data directory.
   * @private
   * @returns {Promise<number>} Number of jobs removed
   */
  async applyRetention() {
    let removed = 0;
    for (const status of ['completed', 'failed']) {
      const grace = this.retention[status];
      if (!Number.isFinite(grace) || grace < 0) continue;
      removed += await this.clean(status, grace);
    }
    return removed;
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

      // Ownership is handed to runJob() only on a successful claim. Every
      // other exit — including an unexpected throw from a read or a write —
      // must release the lock, or the job is stranded in active/ with a lock
      // nobody heartbeats and recovery re-queues it forever.
      let handedOff = false;
      try {
        // STEP 2: Atomic claim — exactly one process wins this rename
        try {
          await this.moveJob('pending', 'active', filename);
        } catch (err) {
          if (err.code === 'ENOENT') continue;
          throw err;
        }

        // STEP 3: Read from active/ (we own it now). A null here means the
        // file vanished or was quarantined — never delete it blindly.
        const job = await this.readJob('active', filename);
        if (!job) continue;

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
          return null;
        }

        // STEP 4: Persist the attempt before running so a crash mid-handler
        // is counted against maxAttempts on recovery
        job.status = JOB_STATUS.ACTIVE;
        job.processedAt = Date.now();
        job.attempts++;
        await this.writeJob('active', job);

        handedOff = true;
        return { job, filename, processor };
      } finally {
        if (!handedOff) await this.releaseLock(filename);
      }
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
