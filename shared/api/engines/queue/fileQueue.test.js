/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

import { JOB_STATUS } from './utils/constants.js';

const waitFor = async (conditionFn, timeout = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await conditionFn()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

jest.mock('uuid', () => ({
  v4: () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
}));

describe('FileQueue Adapter', () => {
  let FileQueue;
  let queue;
  const TEST_DATA_DIR = path.join(process.cwd(), '.xnapify', 'test-queues');

  beforeEach(() => {
    jest.resetModules();
    FileQueue = require('./adapters/file.js').default;

    queue = new FileQueue({
      name: 'test-queue',
      dataDir: TEST_DATA_DIR,
      pollInterval: 50,
      defaultJobOptions: { attempts: 2, backoff: 10 },
    });
  });

  afterEach(async () => {
    if (queue) {
      await queue.close();
    }
    // Clean up test directory
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  // ==================================================================
  // Constructor / Validation
  // ==================================================================

  describe('constructor', () => {
    it('should create directory structure', () => {
      const queueDir = path.join(TEST_DATA_DIR, 'test-queue');
      expect(fs.existsSync(path.join(queueDir, 'pending'))).toBe(true);
      expect(fs.existsSync(path.join(queueDir, 'active'))).toBe(true);
      expect(fs.existsSync(path.join(queueDir, 'completed'))).toBe(true);
      expect(fs.existsSync(path.join(queueDir, 'failed'))).toBe(true);
      expect(fs.existsSync(path.join(queueDir, 'delayed'))).toBe(true);
      expect(fs.existsSync(path.join(queueDir, '.locks'))).toBe(true);
    });

    it('should reject invalid queue names', () => {
      expect(
        () =>
          new FileQueue({
            name: '../../../etc',
            dataDir: TEST_DATA_DIR,
          }),
      ).toThrow('alphanumeric');
    });

    it('should reject names with special characters', () => {
      expect(
        () =>
          new FileQueue({
            name: 'my queue!',
            dataDir: TEST_DATA_DIR,
          }),
      ).toThrow('alphanumeric');
    });

    it('should accept valid names with hyphens and underscores', () => {
      const q = new FileQueue({
        name: 'my-queue_123',
        dataDir: TEST_DATA_DIR,
      });
      expect(q.name).toBe('my-queue_123');
      q.close();
    });

    it('should use default name when none provided', () => {
      const q = new FileQueue({ dataDir: TEST_DATA_DIR });
      expect(q.name).toBe('default');
      q.close();
    });
  });

  // ==================================================================
  // add()
  // ==================================================================

  describe('add()', () => {
    it('should create a job with correct properties', async () => {
      const job = await queue.add('test-event', { key: 'value' });

      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-event');
      expect(job.data).toEqual({ key: 'value' });
      expect(job.status).toBe(JOB_STATUS.PENDING);
      expect(job.queue).toBe('test-queue');
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(2);
    });

    it('should write job file to pending directory', async () => {
      const job = await queue.add('test-event', { key: 'value' });

      const pendingDir = path.join(TEST_DATA_DIR, 'test-queue', 'pending');
      const files = fs.readdirSync(pendingDir);
      expect(files.length).toBe(1);
      expect(files[0]).toContain(job.id);
    });

    it('should create delayed job when delay > 0', async () => {
      const job = await queue.add('delayed-event', {}, { delay: 5000 });

      expect(job.status).toBe(JOB_STATUS.DELAYED);
      expect(job.scheduledFor).toBeGreaterThan(Date.now() - 100);

      const delayedDir = path.join(TEST_DATA_DIR, 'test-queue', 'delayed');
      const files = fs.readdirSync(delayedDir);
      expect(files.length).toBe(1);
    });
  });

  // ==================================================================
  // addBulk()
  // ==================================================================

  describe('addBulk()', () => {
    it('should add multiple jobs', async () => {
      const jobs = await queue.addBulk([
        { name: 'event-1', data: { a: 1 } },
        { name: 'event-2', data: { b: 2 } },
        { name: 'event-3', data: { c: 3 } },
      ]);

      expect(jobs).toHaveLength(3);
      expect(jobs[0].name).toBe('event-1');
      expect(jobs[2].name).toBe('event-3');

      const pendingDir = path.join(TEST_DATA_DIR, 'test-queue', 'pending');
      const files = fs.readdirSync(pendingDir);
      expect(files.length).toBe(3);
    });
  });

  // ==================================================================
  // Job Processing
  // ==================================================================

  describe('job processing', () => {
    it('should process pending jobs and mark completed', async () => {
      await queue.add('task', { value: 42 });

      const completed = [];
      queue.on('completed', job => {
        completed.push(job);
      });

      queue.process(async job => {
        return { processed: job.data.value };
      });

      // Wait for processing
      await waitFor(() => completed.length === 1);

      expect(completed).toHaveLength(1);
      expect(completed[0].status).toBe(JOB_STATUS.COMPLETED);
      expect(completed[0].result).toEqual({ processed: 42 });
    });

    it('should persist completed job when removeOnComplete is false', async () => {
      await queue.add('task', {}, { removeOnComplete: false });

      queue.process(async () => 'done');

      let files = [];
      const completedDir = path.join(TEST_DATA_DIR, 'test-queue', 'completed');
      await waitFor(() => {
        if (!fs.existsSync(completedDir)) return false;
        files = fs.readdirSync(completedDir);
        return files.length === 1;
      });

      expect(files.length).toBe(1);
    });

    it('should remove completed job when removeOnComplete is true', async () => {
      await queue.add('task', {}, { removeOnComplete: true });

      let completedFired = false;
      queue.on('completed', () => {
        completedFired = true;
      });

      queue.process(async () => 'done');

      const completedDir = path.join(TEST_DATA_DIR, 'test-queue', 'completed');
      const pendingDir = path.join(TEST_DATA_DIR, 'test-queue', 'pending');
      const activeDir = path.join(TEST_DATA_DIR, 'test-queue', 'active');

      await waitFor(() => {
        return (
          completedFired &&
          fs.readdirSync(completedDir).length === 0 &&
          fs.readdirSync(pendingDir).length === 0 &&
          fs.readdirSync(activeDir).length === 0
        );
      });

      expect(fs.readdirSync(completedDir).length).toBe(0);
      expect(fs.readdirSync(pendingDir).length).toBe(0);
      expect(fs.readdirSync(activeDir).length).toBe(0);
    });
  });

  // ==================================================================
  // Priority
  // ==================================================================

  describe('priority ordering', () => {
    it('should process higher priority jobs first', async () => {
      queue.pause();

      await queue.add('low', {}, { priority: 1 });
      await queue.add('high', {}, { priority: 10 });
      await queue.add('medium', {}, { priority: 5 });

      const order = [];
      queue.process(async job => {
        order.push(job.name);
      });

      queue.resume();
      await waitFor(() => order.length === 3);

      expect(order[0]).toBe('high');
      expect(order[1]).toBe('medium');
      expect(order[2]).toBe('low');
    });
  });

  // ==================================================================
  // Retry with Backoff
  // ==================================================================

  describe('retry with backoff', () => {
    it('should retry failed jobs up to maxAttempts', async () => {
      let attemptCount = 0;
      await queue.add('retry-me', {}, { attempts: 3, backoff: 10 });

      queue.process(async () => {
        attemptCount++;
        throw new Error('fail');
      });

      // Wait enough for retries
      await waitFor(() => attemptCount >= 3);

      expect(attemptCount).toBe(3);
    });
  });

  // ==================================================================
  // Pause / Resume
  // ==================================================================

  describe('pause() and resume()', () => {
    it('should pause job processing', async () => {
      await queue.add('task', {});
      queue.pause();

      const processed = [];
      queue.process(async job => {
        processed.push(job);
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(processed).toHaveLength(0);
    });

    it('should resume and process queued jobs', async () => {
      await queue.add('task', {});
      queue.pause();

      const processed = [];
      queue.process(async job => {
        processed.push(job);
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(processed).toHaveLength(0);

      queue.resume();
      await waitFor(() => processed.length === 1);
      expect(processed).toHaveLength(1);
    });
  });

  // ==================================================================
  // getJob()
  // ==================================================================

  describe('getJob()', () => {
    it('should return job by ID', async () => {
      const added = await queue.add('find-me', { key: 'value' });
      const found = await queue.getJob(added.id);

      expect(found.id).toBe(added.id);
      expect(found.name).toBe('find-me');
      expect(found.data).toEqual({ key: 'value' });
    });

    it('should throw JobNotFoundError for unknown ID', async () => {
      await expect(queue.getJob('nonexistent')).rejects.toThrow(
        'Job not found',
      );
    });
  });

  // ==================================================================
  // getJobsByStatus()
  // ==================================================================

  describe('getJobsByStatus()', () => {
    it('should filter jobs by status', async () => {
      await queue.add('a', {});
      await queue.add('b', {});

      const pending = await queue.getJobsByStatus('pending');
      expect(pending).toHaveLength(2);
    });
  });

  // ==================================================================
  // removeJob()
  // ==================================================================

  describe('removeJob()', () => {
    it('should remove job by ID', async () => {
      const job = await queue.add('removable', {});
      const removed = await queue.removeJob(job.id);

      expect(removed).toBe(true);

      const pendingDir = path.join(TEST_DATA_DIR, 'test-queue', 'pending');
      expect(fs.readdirSync(pendingDir).length).toBe(0);
    });

    it('should return false for non-existing ID', async () => {
      const removed = await queue.removeJob('nonexistent');
      expect(removed).toBe(false);
    });
  });

  // ==================================================================
  // retryJob()
  // ==================================================================

  describe('retryJob()', () => {
    it('should retry a failed job', async () => {
      await queue.add('retry-me', {}, { attempts: 1, backoff: 10 });

      queue.process(async () => {
        throw new Error('fail');
      });

      await waitFor(async () => {
        const failedJobs = await queue.getJobsByStatus('failed');
        return failedJobs.length === 1;
      });

      queue.pause();

      const failedJobs = await queue.getJobsByStatus('failed');
      expect(failedJobs).toHaveLength(1);

      const retriedJob = await queue.retryJob(failedJobs[0].id);
      expect(retriedJob.status).toBe('pending');
      expect(retriedJob.attempts).toBe(0);
      expect(retriedJob.error).toBeNull();
    });
  });

  // ==================================================================
  // empty()
  // ==================================================================

  describe('empty()', () => {
    it('should remove all pending jobs', async () => {
      await queue.add('a', {});
      await queue.add('b', {});
      await queue.add('c', {});

      await queue.empty();

      const pendingDir = path.join(TEST_DATA_DIR, 'test-queue', 'pending');
      expect(fs.readdirSync(pendingDir).length).toBe(0);
    });
  });

  // ==================================================================
  // clean()
  // ==================================================================

  describe('clean()', () => {
    it('should clean completed jobs', async () => {
      await queue.add('a', {}, { removeOnComplete: false });
      await queue.add('b', {}, { removeOnComplete: false });

      queue.process(async () => 'done');

      await waitFor(async () => {
        const completedJobs = await queue.getJobsByStatus('completed');
        return completedJobs.length === 2;
      });

      const cleaned = await queue.clean('completed', 0);
      expect(cleaned).toBe(2);

      const completedDir = path.join(TEST_DATA_DIR, 'test-queue', 'completed');
      expect(fs.readdirSync(completedDir).length).toBe(0);
    });
  });

  // ==================================================================
  // close()
  // ==================================================================

  describe('close()', () => {
    it('should stop polling and clear timers', async () => {
      queue.process(async () => 'done');
      expect(queue.pollTimer).not.toBeNull();

      await queue.close();

      expect(queue.pollTimer).toBeNull();
      expect(queue.isPaused).toBe(true);
      expect(queue.processors).toHaveLength(0);
    });

    it('should persist meta.json on close', async () => {
      await queue.add('task', {}, { removeOnComplete: false });
      let completed = false;
      queue.on('completed', () => {
        completed = true;
      });
      queue.process(async () => 'done');
      await waitFor(() => completed);

      await queue.close();

      const metaPath = path.join(TEST_DATA_DIR, 'test-queue', 'meta.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      expect(meta.stats.completed).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================================================================
  // getStats()
  // ==================================================================

  describe('getStats()', () => {
    it('should return accurate counts', async () => {
      await queue.add('a', {});
      await queue.add('b', {});

      const stats = await queue.getStats();
      expect(stats.name).toBe('test-queue');
      expect(stats.counts.pending).toBe(2);
      expect(stats.counts.active).toBe(0);
      expect(stats.counts.completed).toBe(0);
    });
  });

  // ==================================================================
  // Events
  // ==================================================================

  describe('on() / off() / emit()', () => {
    it('should register and emit events', async () => {
      const events = [];
      queue.on('completed', job => events.push(job));

      await queue.add('task', {});
      queue.process(async () => 'done');

      await waitFor(() => events.length === 1);
      expect(events).toHaveLength(1);
    });

    it('should remove event handler with off()', () => {
      const handler = () => {};
      queue.on('completed', handler);
      queue.off('completed', handler);

      expect(queue.eventHandlers.completed).toHaveLength(0);
    });

    it('should catch errors in event handlers', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();

      let completedFired = false;
      queue.on('completed', () => {
        completedFired = true;
        throw new Error('handler error');
      });

      await queue.add('task', {});
      queue.process(async () => 'done');

      await waitFor(() => completedFired);

      const errorCalls = spy.mock.calls.filter(
        c => typeof c[0] === 'string' && c[0].includes('event handler'),
      );
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);

      spy.mockRestore();
    });
  });

  // ==================================================================
  // Crash Recovery
  // ==================================================================

  describe('crash recovery', () => {
    it('should recover stale active jobs on startup', async () => {
      // Simulate a crash: write a job directly to active/
      const activeDir = path.join(TEST_DATA_DIR, 'recovery-queue', 'active');
      const pendingDir = path.join(TEST_DATA_DIR, 'recovery-queue', 'pending');
      const dirs = ['pending', 'active', 'completed', 'failed', 'delayed'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(TEST_DATA_DIR, 'recovery-queue', dir), {
          recursive: true,
        });
      }
      fs.mkdirSync(path.join(TEST_DATA_DIR, 'recovery-queue', '.locks'), {
        recursive: true,
      });

      const staleJob = {
        id: 'stale-123',
        name: 'stale-task',
        status: 'active',
        priority: 0,
        createdAt: Date.now() - 10000,
        attempts: 1,
      };
      const filename = `9999-${String(staleJob.createdAt).padStart(15, '0')}-stale-123.json`;
      fs.writeFileSync(
        path.join(activeDir, filename),
        JSON.stringify(staleJob),
      );

      // Create queue — should recover the stale job
      const recoveryQueue = new FileQueue({
        name: 'recovery-queue',
        dataDir: TEST_DATA_DIR,
      });

      const pendingFiles = fs.readdirSync(pendingDir);
      expect(pendingFiles.length).toBe(1);

      const activeFiles = fs.readdirSync(activeDir);
      expect(activeFiles.length).toBe(0);

      await recoveryQueue.close();
    });

    it('should promote expired delayed jobs on startup', async () => {
      // Simulate expired delayed job
      const delayedDir = path.join(TEST_DATA_DIR, 'delayed-queue', 'delayed');
      const pendingDir = path.join(TEST_DATA_DIR, 'delayed-queue', 'pending');
      const dirs = ['pending', 'active', 'completed', 'failed', 'delayed'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(TEST_DATA_DIR, 'delayed-queue', dir), {
          recursive: true,
        });
      }
      fs.mkdirSync(path.join(TEST_DATA_DIR, 'delayed-queue', '.locks'), {
        recursive: true,
      });

      const expiredJob = {
        id: 'expired-456',
        name: 'expired-task',
        status: 'delayed',
        priority: 0,
        createdAt: Date.now() - 60000,
        scheduledFor: Date.now() - 30000, // 30s ago
        attempts: 0,
      };
      const filename = `9999-${String(expiredJob.createdAt).padStart(15, '0')}-expired-456.json`;
      fs.writeFileSync(
        path.join(delayedDir, filename),
        JSON.stringify(expiredJob),
      );

      const delayedQueue = new FileQueue({
        name: 'delayed-queue',
        dataDir: TEST_DATA_DIR,
      });

      const pendingFiles = fs.readdirSync(pendingDir);
      expect(pendingFiles.length).toBe(1);

      const delayedFiles = fs.readdirSync(delayedDir);
      expect(delayedFiles.length).toBe(0);

      await delayedQueue.close();
    });
  });

  // ==================================================================
  // isPausedState()
  // ==================================================================

  describe('isPausedState()', () => {
    it('should reflect paused state', () => {
      expect(queue.isPausedState()).toBe(false);
      queue.pause();
      expect(queue.isPausedState()).toBe(true);
      queue.resume();
      expect(queue.isPausedState()).toBe(false);
    });
  });

  // ==================================================================
  // getJobs()
  // ==================================================================

  describe('getJobs()', () => {
    it('should return all jobs across statuses', async () => {
      await queue.add('a', {});
      await queue.add('b', {});

      const allJobs = await queue.getJobs();
      expect(allJobs).toHaveLength(2);
    });
  });
});

// ============================================================================
// Concurrency, locking and recovery guarantees
// ============================================================================

describe('FileQueue concurrency & recovery', () => {
  let FileQueue;
  const DATA_DIR = path.join(process.cwd(), '.xnapify', 'test-queues-race');
  const opened = [];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const make = (options = {}) => {
    const q = new FileQueue({
      name: 'race',
      dataDir: DATA_DIR,
      pollInterval: 50,
      // These tests exercise claim/lock/recovery mechanics. fsync is a full
      // hardware flush (F_FULLFSYNC on macOS, tens of ms per call) that would
      // make the timing-sensitive races here slow and flaky; the durable write
      // path itself is covered by the durability tests below, and the
      // lifecycle suite above runs on the real default.
      fsync: false,
      defaultJobOptions: { attempts: 2, backoff: 10 },
      ...options,
    });
    opened.push(q);
    return q;
  };

  beforeEach(() => {
    jest.resetModules();
    FileQueue = require('./adapters/file.js').default;
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    while (opened.length) {
      await opened.pop().close();
    }
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('never exceeds concurrency under overlapping triggers', async () => {
    const q = make({ concurrency: 2 });
    let running = 0;
    let peak = 0;
    let done = 0;

    q.process(async () => {
      running++;
      peak = Math.max(peak, running);
      await sleep(60);
      running--;
      done++;
    });

    for (let i = 0; i < 6; i++) {
      await q.add('job', { i });
    }
    // Hammer every entry point that can start a claim
    for (let i = 0; i < 10; i++) {
      q.resume();
      q.tick();
    }

    await waitFor(() => done === 6, 5000);
    expect(done).toBe(6);
    expect(peak).toBe(2);
  });

  it('keeps the index pointing at the new status after completion', async () => {
    const q = make();
    q.process(async () => 'ok');

    const job = await q.add('job', {}, { removeOnComplete: false });
    await waitFor(
      async () => (await q.getJobsByStatus('completed')).length === 1,
    );

    const stored = await q.getJob(job.id);
    expect(stored.status).toBe(JOB_STATUS.COMPLETED);

    const stats = await q.getStats();
    expect(stats.counts.completed).toBe(1);
    expect(stats.counts.active).toBe(0);
  });

  it('keeps the index consistent through failure and retryJob()', async () => {
    const q = make({ defaultJobOptions: { attempts: 1, backoff: 10 } });
    let calls = 0;
    q.process(async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return 'ok';
    });

    const job = await q.add('job', {});
    await waitFor(async () => (await q.getJobsByStatus('failed')).length === 1);

    expect((await q.getJob(job.id)).status).toBe(JOB_STATUS.FAILED);
    expect((await q.getStats()).counts.failed).toBe(1);

    await q.retryJob(job.id);
    await waitFor(() => calls === 2);
    await waitFor(async () => (await q.getJobsByStatus('active')).length === 0);

    expect((await q.getStats()).counts.failed).toBe(0);
    await expect(q.getJob(job.id)).rejects.toThrow();
  });

  it('leaves an active job alone while its lock is fresh, recovers it once stale', async () => {
    const q1 = make();
    const job = await q1.add('job', {});
    const filename = q1.buildFilename(job);
    // Simulate a sibling process mid-job: file in active/ with a fresh lock
    fs.renameSync(
      q1.jobPath('pending', filename),
      q1.jobPath('active', filename),
    );
    fs.writeFileSync(q1.lockPath(filename), '999');
    await q1.close();

    const q2 = make();
    expect(fs.existsSync(q2.jobPath('active', filename))).toBe(true);
    expect(fs.existsSync(q2.jobPath('pending', filename))).toBe(false);

    // Age the lock past the stale threshold — the poll tick must recover it
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(q2.lockPath(filename), old, old);

    let processed = 0;
    q2.process(async () => {
      processed++;
    });
    await waitFor(() => processed === 1);
    expect(processed).toBe(1);
  });

  it('heartbeats the lock so a long-running job is not stolen by a sibling', async () => {
    const q = make({ lockStaleMs: 900 });
    let release;
    let calls = 0;
    q.process(
      () =>
        new Promise(resolve => {
          calls++;
          release = resolve;
        }),
    );
    const job = await q.add('job', {});
    await waitFor(() => calls === 1);
    const filename = q.buildFilename(job);

    // Wait longer than lockStaleMs, then boot a sibling against the same dir
    await sleep(1500);
    const sibling = make({ lockStaleMs: 900 });
    expect(fs.existsSync(sibling.jobPath('active', filename))).toBe(true);
    expect(fs.existsSync(sibling.jobPath('pending', filename))).toBe(false);
    expect(calls).toBe(1);

    release();
    await waitFor(async () => (await q.getJobsByStatus('active')).length === 0);
  });

  it('steals a stale lock left on a pending job', async () => {
    const q = make({ lockStaleMs: 200 });
    const job = await q.add('job', {});
    const lockPath = q.lockPath(q.buildFilename(job));
    fs.writeFileSync(lockPath, '999');
    const old = new Date(Date.now() - 1000);
    fs.utimesSync(lockPath, old, old);

    let processed = 0;
    q.process(async () => {
      processed++;
    });
    await waitFor(() => processed === 1);
    expect(processed).toBe(1);
  });

  it('skips a pending job whose lock is held and takes the next candidate', async () => {
    const q = make();
    const a = await q.add('job', { n: 'a' }, { priority: 10 });
    await q.add('job', { n: 'b' });
    const lockA = q.lockPath(q.buildFilename(a));
    fs.writeFileSync(lockA, '999'); // held by someone else, fresh

    const seen = [];
    q.process(async j => {
      seen.push(j.data.n);
    });

    await waitFor(() => seen.length === 1);
    expect(seen).toEqual(['b']);

    fs.unlinkSync(lockA);
    await waitFor(() => seen.length === 2);
    expect(seen).toEqual(['b', 'a']);
  });

  it('finds and removes jobs written by another process via disk scan', async () => {
    const writer = make();
    const reader = make(); // indexed before the job below exists

    const job = await writer.add('job', { x: 2 });
    expect(reader.jobIndex.has(job.id)).toBe(false);

    const found = await reader.getJob(job.id);
    expect(found.data.x).toBe(2);
    expect(await reader.removeJob(job.id)).toBe(true);
    await expect(reader.getJob(job.id)).rejects.toThrow();
  });

  it('processes a newly added job without waiting for the poll interval', async () => {
    const q = make({ pollInterval: 5000 });
    let processed = 0;
    q.process(async () => {
      processed++;
    });

    const start = Date.now();
    await q.add('job', {});
    await waitFor(() => processed === 1, 2000);

    expect(processed).toBe(1);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('close() drains running jobs before returning', async () => {
    const q = make();
    let finished = false;
    q.process(async () => {
      await sleep(150);
      finished = true;
    });

    await q.add('job', {});
    await waitFor(() => q.activeJobs === 1);
    await q.close();

    expect(finished).toBe(true);
    expect(await q.getJobsByStatus('active')).toHaveLength(0);
  });

  // ==================================================================
  // Crash-failure dead-lettering (attempts ceiling on the recovery path)
  // ==================================================================

  it('dead-letters an abandoned job that has used every attempt (boot)', async () => {
    const dirs = ['pending', 'active', 'completed', 'failed', 'delayed'];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(DATA_DIR, 'race', dir), { recursive: true });
    }
    fs.mkdirSync(path.join(DATA_DIR, 'race', '.locks'), { recursive: true });

    const poison = {
      id: 'poison-1',
      name: 'poison',
      status: 'active',
      priority: 0,
      createdAt: Date.now() - 10_000,
      attempts: 99,
      maxAttempts: 1,
    };
    const filename = `9999-${String(poison.createdAt).padStart(15, '0')}-poison-1.json`;
    fs.writeFileSync(
      path.join(DATA_DIR, 'race', 'active', filename),
      JSON.stringify(poison),
    );

    // No lock file → the boot recovery path picks it up.
    const q = make();

    expect(fs.readdirSync(path.join(DATA_DIR, 'race', 'pending'))).toHaveLength(
      0,
    );
    expect(fs.readdirSync(path.join(DATA_DIR, 'race', 'active'))).toHaveLength(
      0,
    );
    const failed = await q.getJobsByStatus('failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe('poison-1');
    expect(failed[0].status).toBe(JOB_STATUS.FAILED);
    expect(failed[0].error.message).toMatch(/abandoned/i);
  });

  it('dead-letters an abandoned job that has used every attempt (poll tick)', async () => {
    const q = make();
    const job = await q.add('job', {}, { attempts: 1 });
    const filename = q.buildFilename(job);

    // Simulate a worker that claimed the job (attempt spent) and then died.
    const stored = JSON.parse(
      fs.readFileSync(q.jobPath('pending', filename), 'utf8'),
    );
    stored.status = JOB_STATUS.ACTIVE;
    stored.attempts = 1;
    fs.writeFileSync(
      q.jobPath('pending', filename),
      JSON.stringify(stored),
      'utf8',
    );
    fs.renameSync(
      q.jobPath('pending', filename),
      q.jobPath('active', filename),
    );

    let ran = 0;
    q.process(async () => {
      ran++;
    });

    await waitFor(async () => (await q.getJobsByStatus('failed')).length === 1);
    const failed = await q.getJobsByStatus('failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe(job.id);
    expect(ran).toBe(0);
  });

  // ==================================================================
  // Corrupt job files are quarantined, never deleted
  // ==================================================================

  it('quarantines an unreadable pending job instead of destroying it', async () => {
    const q = make();
    const job = await q.add('job', {});
    const filename = q.buildFilename(job);
    // Valid JSON, but no id — exactly what a torn write can look like.
    fs.writeFileSync(
      q.jobPath('pending', filename),
      JSON.stringify({ name: 'job', data: {} }),
      'utf8',
    );

    q.process(async () => 'ok');

    const corruptDir = path.join(DATA_DIR, 'race', 'corrupt');
    await waitFor(() => fs.readdirSync(corruptDir).length === 1);

    const quarantined = fs.readdirSync(corruptDir);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toContain(filename);
    expect(fs.existsSync(q.jobPath('pending', filename))).toBe(false);
    expect(fs.existsSync(q.jobPath('active', filename))).toBe(false);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(corruptDir, quarantined[0]), 'utf8'),
      ),
    ).toEqual({ name: 'job', data: {} });
  });

  it('quarantines unparseable JSON instead of throwing out of the tick', async () => {
    const q = make();
    const job = await q.add('job', {});
    const filename = q.buildFilename(job);
    fs.writeFileSync(
      q.jobPath('pending', filename),
      '{"id":"a", trunc',
      'utf8',
    );

    let processed = 0;
    q.process(async () => {
      processed++;
    });

    const corruptDir = path.join(DATA_DIR, 'race', 'corrupt');
    await waitFor(() => fs.readdirSync(corruptDir).length === 1);
    expect(fs.readdirSync(corruptDir)).toHaveLength(1);

    // The queue is still healthy afterwards — the tick did not blow up and
    // the claim lock was not left behind.
    await q.add('job', {});
    await waitFor(() => processed === 1);
    expect(processed).toBe(1);
  });

  // ==================================================================
  // Lock hygiene
  // ==================================================================

  it('releases the claim lock when the claim throws unexpectedly', async () => {
    const q = make();
    const job = await q.add('job', {});
    const filename = q.buildFilename(job);

    const realWriteJob = q.writeJob.bind(q);
    let injected = false;
    q.writeJob = async (status, j) => {
      if (!injected && status === 'active') {
        injected = true;
        const err = new Error('no space left on device');
        err.code = 'ENOSPC';
        throw err;
      }
      return realWriteJob(status, j);
    };

    let processed = 0;
    q.process(async () => {
      processed++;
    });

    await waitFor(() => injected);
    // Without the try/finally the lock would stay behind forever and the job
    // would be stranded in active/ with a frozen lock mtime.
    await waitFor(() => !fs.existsSync(q.lockPath(filename)));
    expect(fs.existsSync(q.lockPath(filename))).toBe(false);

    await waitFor(() => processed === 1);
    expect(processed).toBe(1);
  });

  it('does not release a lock that now belongs to another owner', async () => {
    const q = make();
    const job = await q.add('job', {});
    const filename = q.buildFilename(job);

    expect(await q.acquireLock(filename)).toBe(true);
    // A stale-lock steal by a sibling, followed by that sibling's own lock.
    fs.writeFileSync(q.lockPath(filename), 'other-owner:1');

    await q.releaseLock(filename);

    expect(fs.existsSync(q.lockPath(filename))).toBe(true);
    expect(fs.readFileSync(q.lockPath(filename), 'utf8')).toBe('other-owner:1');
  });

  it('stops heartbeating once the lock belongs to another owner', async () => {
    const q = make({ lockStaleMs: 1000 });
    let release;
    q.process(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    const job = await q.add('job', {});
    await waitFor(() => q.activeJobs === 1);
    const filename = q.buildFilename(job);

    // Sibling steals the lock and installs its own.
    fs.writeFileSync(q.lockPath(filename), 'other-owner:1');

    await waitFor(() => !q.heartbeats.has(filename), 2000);
    expect(q.heartbeats.has(filename)).toBe(false);
    expect(fs.readFileSync(q.lockPath(filename), 'utf8')).toBe('other-owner:1');

    release();
    await waitFor(() => q.activeJobs === 0);
    // The finally must not delete the successor's lock either.
    expect(fs.readFileSync(q.lockPath(filename), 'utf8')).toBe('other-owner:1');
    fs.unlinkSync(q.lockPath(filename));
  });

  it('keeps heartbeating a job that outlives the close() drain', async () => {
    const q = make({ drainTimeout: 100, lockStaleMs: 750 });
    let release;
    q.process(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    const job = await q.add('job', {});
    await waitFor(() => q.activeJobs === 1);
    const filename = q.buildFilename(job);
    const before = fs.statSync(q.lockPath(filename)).mtimeMs;

    await q.close();

    // The handler is still running: its lock must keep being refreshed, or a
    // sibling would declare it abandoned and run the same work concurrently.
    expect(q.activeJobs).toBe(1);
    expect(q.heartbeats.has(filename)).toBe(true);
    await waitFor(
      () => fs.statSync(q.lockPath(filename)).mtimeMs > before,
      2000,
    );
    expect(fs.statSync(q.lockPath(filename)).mtimeMs).toBeGreaterThan(before);

    release();
    await waitFor(() => q.activeJobs === 0);
    expect(q.heartbeats.has(filename)).toBe(false);
  });

  it('clamps a lockStaleMs shorter than the heartbeat interval', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const q = make({ lockStaleMs: 100 });

    expect(q.lockStaleMs).toBe(750);
    expect(q.heartbeatMs).toBeLessThanOrEqual(q.lockStaleMs / 3);
    expect(
      warn.mock.calls.some(
        c => typeof c[0] === 'string' && c[0].includes('lockStaleMs'),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  // ==================================================================
  // Delayed promotion cost
  // ==================================================================

  it('does not lock or read delayed jobs that are not due yet', async () => {
    const q = make();
    await q.add('later', {}, { delay: 60_000 });

    const acquire = jest.spyOn(q, 'acquireLock');
    const read = jest.spyOn(q, 'readJob');

    await q.promoteExpiredDelayed();
    read.mockClear(); // first pass populates the due-ness cache
    await q.promoteExpiredDelayed();
    await q.promoteExpiredDelayed();

    expect(acquire).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();

    acquire.mockRestore();
    read.mockRestore();
  });

  it('still promotes a delayed job once it becomes due', async () => {
    const q = make();
    const job = await q.add('soon', {}, { delay: 40 });
    await q.promoteExpiredDelayed();
    expect(await q.getJobsByStatus('delayed')).toHaveLength(1);

    await sleep(80);
    await q.promoteExpiredDelayed();

    expect(await q.getJobsByStatus('delayed')).toHaveLength(0);
    const pending = await q.getJobsByStatus('pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(job.id);
    expect(pending[0].status).toBe(JOB_STATUS.PENDING);
  });

  // ==================================================================
  // Housekeeping
  // ==================================================================

  it('does not accumulate debounce timers in the tracking set', async () => {
    const q = make();

    q.markMetaDirty();
    q.markMetaDirty();
    expect(q.timers.size).toBe(1);

    await waitFor(() => q.timers.size === 0, 3000);
    expect(q.timers.size).toBe(0);

    q.markMetaDirty();
    await waitFor(() => q.timers.size === 0, 3000);
    expect(q.timers.size).toBe(0);
  });

  it('sweeps orphaned .tmp and *.stale artifacts older than the grace period', async () => {
    const q = make();
    const orphanTmp = path.join(
      DATA_DIR,
      'race',
      'pending',
      '9999-000000000000001-x.json-1-abc.tmp',
    );
    const orphanStale = path.join(
      DATA_DIR,
      'race',
      '.locks',
      '9999-000000000000001-x.json.lock-1-abc.stale',
    );
    const freshTmp = path.join(
      DATA_DIR,
      'race',
      'pending',
      '9999-000000000000002-y.json-1-def.tmp',
    );
    fs.writeFileSync(orphanTmp, '{}');
    fs.writeFileSync(orphanStale, '1');
    fs.writeFileSync(freshTmp, '{}');
    const old = new Date(Date.now() - 5 * 60_000);
    fs.utimesSync(orphanTmp, old, old);
    fs.utimesSync(orphanStale, old, old);

    expect(await q.sweepArtifacts()).toBe(2);
    expect(fs.existsSync(orphanTmp)).toBe(false);
    expect(fs.existsSync(orphanStale)).toBe(false);
    // Still inside the grace window — a concurrent write must survive.
    expect(fs.existsSync(freshTmp)).toBe(true);
  });

  it('applies the retention policy to completed and failed jobs', async () => {
    const q = make({ retention: { completed: 0, failed: 0 } });
    const stamp = Date.now() - 60_000;
    const done = {
      id: 'done-1',
      name: 'x',
      status: JOB_STATUS.COMPLETED,
      priority: 0,
      createdAt: stamp,
      completedAt: stamp,
    };
    const dead = {
      id: 'dead-1',
      name: 'x',
      status: JOB_STATUS.FAILED,
      priority: 0,
      createdAt: stamp,
      failedAt: stamp,
    };
    fs.writeFileSync(
      q.jobPath('completed', q.buildFilename(done)),
      JSON.stringify(done),
    );
    fs.writeFileSync(
      q.jobPath('failed', q.buildFilename(dead)),
      JSON.stringify(dead),
    );

    expect(await q.applyRetention()).toBe(2);
    expect(await q.getJobsByStatus('completed')).toHaveLength(0);
    expect(await q.getJobsByStatus('failed')).toHaveLength(0);
  });

  it('leaves terminal jobs alone when retention is disabled', async () => {
    const q = make({ retention: { completed: null, failed: null } });
    const stamp = Date.now() - 60_000;
    const dead = {
      id: 'dead-2',
      name: 'x',
      status: JOB_STATUS.FAILED,
      priority: 0,
      createdAt: stamp,
      failedAt: stamp,
    };
    fs.writeFileSync(
      q.jobPath('failed', q.buildFilename(dead)),
      JSON.stringify(dead),
    );

    expect(await q.applyRetention()).toBe(0);
    expect(await q.getJobsByStatus('failed')).toHaveLength(1);
  });

  // ==================================================================
  // Durability
  // ==================================================================

  it('fsyncs the file and its directory only in durable mode', async () => {
    const q = make();
    const dirSync = jest.spyOn(q, 'fsyncDir').mockResolvedValue(undefined);
    const pendingDir = path.join(DATA_DIR, 'race', 'pending');
    const target = path.join(pendingDir, 'durability-probe.json');

    await q.writeFileAtomic(target, '{"a":1}', { durable: true });
    expect(dirSync).toHaveBeenCalledWith(pendingDir);
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');

    dirSync.mockClear();
    await q.writeFileAtomic(target, '{"a":2}', { durable: false });
    expect(dirSync).not.toHaveBeenCalled();
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":2}');

    // Neither mode may leave scratch files behind.
    expect(fs.readdirSync(pendingDir).filter(f => f.endsWith('.tmp'))).toEqual(
      [],
    );
    dirSync.mockRestore();
  });

  it('writes jobs through the durable path unless fsync is disabled', async () => {
    // Durability is the default; only these tests opt out of it.
    const defaults = new FileQueue({ name: 'race', dataDir: DATA_DIR });
    opened.push(defaults);
    expect(defaults.fsync).toBe(true);

    const durable = make({ fsync: true });

    const spy = jest.spyOn(durable, 'writeFileAtomic');
    const job = await durable.add('job', {});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(job.id),
      expect.any(String),
      { durable: true },
    );

    spy.mockClear();
    const buffered = make({ fsync: false });
    const bufferedSpy = jest.spyOn(buffered, 'writeFileAtomic');
    await buffered.add('job', {});
    expect(bufferedSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { durable: false },
    );

    spy.mockRestore();
    bufferedSpy.mockRestore();
  });

  // ==================================================================
  // Stats
  // ==================================================================

  it('counts jobs written by another process in getStats()', async () => {
    const writer = make();
    const reader = make(); // indexed before the job below exists

    await writer.add('job', {});
    expect(reader.jobIndex.size).toBe(0);

    const stats = await reader.getStats();
    expect(stats.counts.pending).toBe(1);
  });
});
