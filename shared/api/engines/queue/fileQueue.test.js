/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import { JOB_STATUS } from './utils/constants';

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
    FileQueue = require('./adapters/file').default;

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
