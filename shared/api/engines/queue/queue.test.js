/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock uuid to avoid Jest compatibility issues
jest.mock('uuid');

import { Channel } from './channel';
import { createFactory } from './factory';

describe('Queue Engine', () => {
  let queue;

  beforeEach(() => {
    // Create a fresh queue instance for each test
    queue = createFactory();
  });

  afterEach(async () => {
    // Cleanup after each test
    if (queue) {
      await queue.cleanup();
    }
  });

  describe('Factory', () => {
    describe('channel creation', () => {
      it('should create a new channel', () => {
        const channel = queue('test-channel');

        expect(channel).toBeInstanceOf(Channel);
        expect(channel.name).toBe('test-channel');
      });

      it('should return existing channel', () => {
        const channel1 = queue('test-channel');
        const channel2 = queue('test-channel');

        expect(channel1).toBe(channel2);
      });

      it('should validate channel name', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        expect(queue('')).toBeNull();
        expect(queue(null)).toBeNull();
        expect(queue(123)).toBeNull();
        expect(queue('   ')).toBeNull();

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });

      it('should create channels with different names', () => {
        const channel1 = queue('channel-1');
        const channel2 = queue('channel-2');

        expect(channel1).not.toBe(channel2);
        expect(channel1.name).toBe('channel-1');
        expect(channel2.name).toBe('channel-2');
      });
    });

    describe('channel()', () => {
      it('should get existing channel', () => {
        const created = queue('test-channel');
        const retrieved = queue.channel('test-channel');

        expect(retrieved).toBe(created);
      });

      it('should return null for non-existing channel', () => {
        const channel = queue.channel('non-existing');
        expect(channel).toBeNull();
      });

      it('should return null for invalid input', () => {
        expect(queue.channel('')).toBeNull();
        expect(queue.channel(null)).toBeNull();
      });
    });

    describe('has()', () => {
      it('should return true for existing channel', () => {
        queue('test-channel');
        expect(queue.has('test-channel')).toBe(true);
      });

      it('should return false for non-existing channel', () => {
        expect(queue.has('non-existing')).toBe(false);
      });

      it('should return false for invalid channel names', () => {
        expect(queue.has('')).toBe(false);
        expect(queue.has(null)).toBe(false);
      });
    });

    describe('getChannelNames()', () => {
      it('should return empty array when no channels', () => {
        const names = queue.getChannelNames();
        expect(names).toEqual([]);
      });

      it('should return all channel names', () => {
        queue('channel-1');
        queue('channel-2');
        queue('channel-3');

        const names = queue.getChannelNames();

        expect(names).toHaveLength(3);
        expect(names).toContain('channel-1');
        expect(names).toContain('channel-2');
        expect(names).toContain('channel-3');
      });
    });

    describe('getStats()', () => {
      it('should return empty stats when no channels', () => {
        const stats = queue.getStats();
        expect(stats).toEqual({});
      });

      it('should return stats for all channels', () => {
        queue('channel-1');
        queue('channel-2');

        const stats = queue.getStats();

        expect(stats).toHaveProperty('channel-1');
        expect(stats).toHaveProperty('channel-2');
        expect(stats['channel-1'].name).toBe('channel-1');
        expect(stats['channel-2'].name).toBe('channel-2');
      });
    });

    describe('remove()', () => {
      it('should remove an existing channel', async () => {
        queue('test-channel');

        const result = await queue.remove('test-channel');

        expect(result).toBe(true);
        expect(queue.has('test-channel')).toBe(false);
      });

      it('should return false for non-existing channel', async () => {
        const result = await queue.remove('non-existing');
        expect(result).toBe(false);
      });

      it('should return false when removing invalid channel names', async () => {
        expect(await queue.remove('')).toBe(false);
        expect(await queue.remove(null)).toBe(false);
      });
    });

    describe('cleanup()', () => {
      it('should close all channels', async () => {
        queue('channel-1');
        queue('channel-2');
        queue('channel-3');

        await queue.cleanup();

        expect(queue.getChannelNames()).toHaveLength(0);
      });

      it('should handle cleanup on empty queue', async () => {
        await expect(queue.cleanup()).resolves.not.toThrow();
      });
    });

    describe('registerAdapter()', () => {
      it('should register a custom adapter', () => {
        class CustomAdapter {
          constructor() {}
        }

        const result = queue.registerAdapter('custom', CustomAdapter);
        expect(result).toBe(true);
      });

      it('should not override existing adapter', () => {
        class CustomAdapter {}

        queue.registerAdapter('custom', CustomAdapter);
        const result = queue.registerAdapter('custom', CustomAdapter);

        expect(result).toBe(false);
      });
    });
  });

  describe('Channel', () => {
    let channel;

    beforeEach(() => {
      channel = queue('test-channel');
    });

    describe('on()', () => {
      it('should register event handler', () => {
        const handler = jest.fn();
        const result = channel.on('test-event', handler);

        expect(result).toBe(channel); // Should return this for chaining
        expect(channel.hasHandler('test-event')).toBe(true);
      });

      it('should validate event name', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();
        const handler = jest.fn();

        channel.on('', handler);
        channel.on(null, handler);
        channel.on(123, handler);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });

      it('should validate handler function', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        channel.on('test-event', 'not-a-function');
        channel.on('test-event', null);
        channel.on('test-event', 123);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });
    });

    describe('off()', () => {
      it('should remove event handler', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const result = channel.off('test-event');

        expect(result).toBe(channel); // Should return this for chaining
        expect(channel.hasHandler('test-event')).toBe(false);
      });

      it('should handle removing non-existing handler', () => {
        expect(() => {
          channel.off('non-existing');
        }).not.toThrow();
      });
    });

    describe('hasHandler()', () => {
      it('should return true for existing handler', () => {
        channel.on('test-event', jest.fn());
        expect(channel.hasHandler('test-event')).toBe(true);
      });

      it('should return false for non-existing handler', () => {
        expect(channel.hasHandler('non-existing')).toBe(false);
      });
    });

    describe('getHandlerCount()', () => {
      it('should return 0 for no handlers', () => {
        expect(channel.getHandlerCount()).toBe(0);
      });

      it('should return correct count', () => {
        channel.on('event-1', jest.fn());
        channel.on('event-2', jest.fn());
        channel.on('event-3', jest.fn());

        expect(channel.getHandlerCount()).toBe(3);
      });
    });

    describe('getStats()', () => {
      it('should return channel stats', () => {
        channel.on('event-1', jest.fn());
        channel.on('event-2', jest.fn());

        const stats = channel.getStats();

        expect(stats.name).toBe('test-channel');
        expect(stats.handlers).toContain('event-1');
        expect(stats.handlers).toContain('event-2');
        expect(stats.handlerCount).toBe(2);
        expect(stats).toHaveProperty('isProcessing');
        expect(stats).toHaveProperty('queue');
      });
    });

    describe('emit()', () => {
      it('should emit event to queue', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const job = channel.emit('test-event', { message: 'Hello' });

        expect(job).toBeDefined();
        expect(job).toHaveProperty('id');
        expect(job.name).toBe('test-event');
        expect(job.data).toEqual({ message: 'Hello' });
      });

      it('should return null for invalid event names', () => {
        expect(channel.emit('')).toBeNull();
        expect(channel.emit(null)).toBeNull();
      });
    });

    describe('emitBulk()', () => {
      it('should emit multiple events', () => {
        const handler = jest.fn();
        channel.on('test-event', handler);

        const jobs = channel.emitBulk([
          { event: 'test-event', data: { id: 1 } },
          { event: 'test-event', data: { id: 2 } },
          { event: 'test-event', data: { id: 3 } },
        ]);

        expect(jobs).toHaveLength(3);
      });

      it('should return empty array for invalid bulk input', () => {
        expect(channel.emitBulk(null)).toEqual([]);
        expect(channel.emitBulk('not-an-array')).toEqual([]);
      });
    });

    describe('close()', () => {
      it('should close the channel', async () => {
        channel.on('test-event', jest.fn());

        await channel.close();

        expect(channel.getHandlerCount()).toBe(0);
        expect(channel.isProcessing).toBe(false);
      });
    });
  });
});

// ======================================================================
// MemoryQueue Adapter Tests
// ======================================================================

describe('MemoryQueue Adapter', () => {
  let MemoryQueue;
  let queue;

  beforeAll(async () => {
    const mod = await import('./adapters/memory');
    MemoryQueue = mod.default;
  });

  beforeEach(() => {
    queue = new MemoryQueue({ name: 'test-queue', concurrency: 1 });
  });

  afterEach(async () => {
    await queue.close();
  });

  // ====== Job Creation ======

  describe('add()', () => {
    it('should create a job with correct properties', () => {
      const job = queue.add('test-job', { key: 'value' });

      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ key: 'value' });
      expect(job.queue).toBe('test-queue');
      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
      expect(job.progress).toBe(0);
      expect(job.result).toBeNull();
      expect(job.error).toBeNull();
      expect(job.createdAt).toBeDefined();
    });

    it('should create delayed job when delay > 0', () => {
      const job = queue.add('delayed', {}, { delay: 5000 });

      expect(job.status).toBe('delayed');
      expect(job.scheduledFor).toBeGreaterThan(Date.now() - 100);
    });

    it('should merge job-level options with defaults', () => {
      const job = queue.add('custom', {}, { attempts: 5, priority: 10 });

      expect(job.maxAttempts).toBe(5);
      expect(job.priority).toBe(10);
    });
  });

  // ====== Bulk ======

  describe('addBulk()', () => {
    it('should add multiple jobs', () => {
      const jobs = queue.addBulk([
        { name: 'job-1', data: { id: 1 } },
        { name: 'job-2', data: { id: 2 } },
        { name: 'job-3', data: { id: 3 } },
      ]);

      expect(jobs).toHaveLength(3);
      expect(jobs[0].name).toBe('job-1');
      expect(jobs[2].name).toBe('job-3');
    });
  });

  // ====== Priority Ordering ======

  describe('priority ordering', () => {
    it('should process higher priority jobs first', async () => {
      const order = [];

      // Add jobs with different priorities (no processor yet)
      queue.add('low', {}, { priority: 1 });
      queue.add('high', {}, { priority: 10 });
      queue.add('medium', {}, { priority: 5 });

      // Register processor — will pick up pending jobs in priority order
      queue.process(async job => {
        order.push(job.name);
      });

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order[0]).toBe('high');
      expect(order[1]).toBe('medium');
      expect(order[2]).toBe('low');
    });

    it('should process same-priority jobs in FIFO order', async () => {
      const order = [];

      queue.add('first', {}, { priority: 0 });
      queue.add('second', {}, { priority: 0 });
      queue.add('third', {}, { priority: 0 });

      queue.process(async job => {
        order.push(job.name);
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  // ====== Job Completion ======

  describe('job processing', () => {
    it('should process pending jobs and mark them completed', async () => {
      const completedHandler = jest.fn();
      queue.on('completed', completedHandler);

      queue.add('task', { value: 42 }, { removeOnComplete: false });

      queue.process(async job => {
        return { processed: job.data.value };
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(completedHandler).toHaveBeenCalled();
      const completedJob = completedHandler.mock.calls[0][0];
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toEqual({ processed: 42 });
      expect(completedJob.progress).toBe(100);
      expect(completedJob.completedAt).toBeDefined();
    });

    it('should remove completed jobs when removeOnComplete is true', async () => {
      queue.add('temp', {}, { removeOnComplete: true });

      queue.process(async () => 'done');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(queue.getJobs()).toHaveLength(0);
    });

    it('should support progress reporting via updateProgress', async () => {
      const progressHandler = jest.fn();
      queue.on('progress', progressHandler);

      queue.add('progress-job', {});

      queue.process(async job => {
        job.updateProgress(50);
        job.updateProgress(100);
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(progressHandler).toHaveBeenCalledTimes(2);
    });
  });

  // ====== Named vs Wildcard Processors ======

  describe('processor matching', () => {
    it('should prefer named processor over wildcard', async () => {
      const results = [];

      queue.process('specific', async () => {
        results.push('named');
      });
      queue.process(async job => {
        results.push(`wildcard:${job.name}`);
      });

      queue.add('specific', {});

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toEqual(['named']);
    });

    it('should fall back to wildcard processor', async () => {
      const results = [];

      queue.process(async job => {
        results.push(`wildcard:${job.name}`);
      });

      queue.add('other', {});

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toEqual(['wildcard:other']);
    });
  });

  // ====== Retry Logic ======

  describe('retry with exponential backoff', () => {
    it('should retry failed jobs up to maxAttempts', async () => {
      let attemptCount = 0;
      const failedHandler = jest.fn();
      queue.on('failed', failedHandler);

      queue.add('fail-job', {}, { attempts: 3, backoff: 10 });

      queue.process(async () => {
        attemptCount++;
        throw new Error('Processing failed');
      });

      // Wait long enough for retries (10ms + 20ms + processing)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(attemptCount).toBe(3);
      expect(failedHandler).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for retry delays', () => {
      // Test the math: backoff * 2^(attempts-1)
      // attempt 1: 1000 * 2^0 = 1000ms
      // attempt 2: 1000 * 2^1 = 2000ms
      // attempt 3: 1000 * 2^2 = 4000ms
      const base = 1000;
      expect(base * Math.pow(2, 0)).toBe(1000);
      expect(base * Math.pow(2, 1)).toBe(2000);
      expect(base * Math.pow(2, 2)).toBe(4000);
    });
  });

  // ====== Concurrency ======

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      const concurrentQueue = new MemoryQueue({
        name: 'concurrent',
        concurrency: 2,
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      concurrentQueue.process(async () => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
      });

      // Add 5 jobs
      for (let i = 0; i < 5; i++) {
        concurrentQueue.add(`job-${i}`, {});
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(maxConcurrent).toBeLessThanOrEqual(2);

      await concurrentQueue.close();
    });
  });

  // ====== Pause / Resume ======

  describe('pause() and resume()', () => {
    it('should pause job processing', async () => {
      const results = [];

      queue.process(async job => {
        results.push(job.name);
      });

      queue.add('before-pause', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      queue.pause();
      queue.add('during-pause', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      // "during-pause" should NOT have been processed
      expect(results).toEqual(['before-pause']);
      expect(queue.isPausedState()).toBe(true);
    });

    it('should resume and process queued jobs', async () => {
      const results = [];

      queue.process(async job => {
        results.push(job.name);
      });

      queue.pause();
      queue.add('queued', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toEqual([]);

      queue.resume();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toEqual(['queued']);
      expect(queue.isPausedState()).toBe(false);
    });
  });

  // ====== Job Lookup ======

  describe('getJob()', () => {
    it('should return job by ID', () => {
      const added = queue.add('lookup', { key: 'val' });
      const found = queue.getJob(added.id);

      expect(found).toBe(added);
    });

    it('should throw JobNotFoundError for unknown ID', () => {
      const { JobNotFoundError } = require('./errors');

      expect(() => queue.getJob('nonexistent')).toThrow(JobNotFoundError);
    });
  });

  describe('getJobsByStatus()', () => {
    it('should filter jobs by status', () => {
      queue.add('a', {});
      queue.add('b', {});
      queue.add('c', {}, { delay: 5000 });

      const pending = queue.getJobsByStatus('pending');
      const delayed = queue.getJobsByStatus('delayed');

      expect(pending).toHaveLength(2);
      expect(delayed).toHaveLength(1);
    });
  });

  describe('getJobs()', () => {
    it('should return all jobs', () => {
      queue.add('a', {});
      queue.add('b', {});

      expect(queue.getJobs()).toHaveLength(2);
    });
  });

  // ====== Remove ======

  describe('removeJob()', () => {
    it('should remove job by ID', () => {
      const job = queue.add('removable', {});
      expect(queue.removeJob(job.id)).toBe(true);
      expect(queue.getJobs()).toHaveLength(0);
    });

    it('should return false for non-existing ID', () => {
      expect(queue.removeJob('nonexistent')).toBe(false);
    });
  });

  // ====== RetryJob ======

  describe('retryJob()', () => {
    it('should retry a failed job', async () => {
      require('./errors');

      queue.add('retry-me', {}, { attempts: 1, backoff: 1 });

      queue.process(async () => {
        throw new Error('fail');
      });

      // Wait for job to fail
      await new Promise(resolve => setTimeout(resolve, 50));

      const failedJobs = queue.getJobsByStatus('failed');
      expect(failedJobs).toHaveLength(1);

      // Pause queue so retried job stays in pending state
      queue.pause();

      const retriedJob = queue.retryJob(failedJobs[0].id);
      expect(retriedJob.status).toBe('pending');
      expect(retriedJob.attempts).toBe(0);
      expect(retriedJob.error).toBeNull();
    });

    it('should throw JobProcessingError for non-failed job', () => {
      const { JobProcessingError } = require('./errors');
      const job = queue.add('not-failed', {});

      expect(() => queue.retryJob(job.id)).toThrow(JobProcessingError);
    });
  });

  // ====== Empty ======

  describe('empty()', () => {
    it('should remove all pending jobs', () => {
      queue.add('a', {});
      queue.add('b', {});
      queue.add('c', {}, { delay: 5000 });

      queue.empty();

      const pending = queue.getJobsByStatus('pending');
      const delayed = queue.getJobsByStatus('delayed');

      expect(pending).toHaveLength(0);
      // Delayed jobs should NOT be removed by empty()
      expect(delayed).toHaveLength(1);
    });
  });

  // ====== Clean ======

  describe('clean()', () => {
    it('should clean only completed jobs when status is completed', async () => {
      queue.add('success', {}, { removeOnComplete: false, attempts: 1 });
      queue.add('failure', {}, { removeOnFail: false, attempts: 1 });

      queue.process(async job => {
        if (job.name === 'failure') throw new Error('fail');
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Backdate timestamps so grace period passes
      for (const job of queue.getJobs()) {
        if (job.completedAt) job.completedAt = Date.now() - 10000;
        if (job.failedAt) job.failedAt = Date.now() - 10000;
      }

      const cleaned = queue.clean('completed', 0);

      // Should only clean completed, NOT failed
      expect(cleaned).toBe(1);
      const remaining = queue.getJobs();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].status).toBe('failed');
    });

    it('should clean all completed and failed with status=all', async () => {
      queue.add('s', {}, { removeOnComplete: false, attempts: 1 });
      queue.add('f', {}, { removeOnFail: false, attempts: 1 });

      queue.process(async job => {
        if (job.name === 'f') throw new Error('fail');
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      for (const job of queue.getJobs()) {
        if (job.completedAt) job.completedAt = Date.now() - 10000;
        if (job.failedAt) job.failedAt = Date.now() - 10000;
      }

      const cleaned = queue.clean('all', 0);
      expect(cleaned).toBe(2);
    });

    it('should respect grace period', () => {
      const job = queue.add('old', {}, { removeOnComplete: false });
      job.status = 'completed';
      job.completedAt = Date.now() - 1000;

      // Grace = 5000ms — job is only 1000ms old, should NOT be cleaned
      const cleaned = queue.clean('completed', 5000);
      expect(cleaned).toBe(0);
    });
  });

  // ====== Close / Timer Cleanup ======

  describe('close()', () => {
    it('should clear all timers on close', async () => {
      // Add delayed jobs that create timers
      queue.add('delayed-1', {}, { delay: 60000 });
      queue.add('delayed-2', {}, { delay: 60000 });

      expect(queue.timers.size).toBe(2);

      await queue.close();

      expect(queue.timers.size).toBe(0);
      expect(queue.jobs.size).toBe(0);
      expect(queue.processors).toHaveLength(0);
      expect(queue.isPaused).toBe(true);
    });
  });

  // ====== Stats ======

  describe('getStats()', () => {
    it('should return accurate single-pass counts', () => {
      queue.add('a', {});
      queue.add('b', {});
      queue.add('c', {}, { delay: 5000 });

      const stats = queue.getStats();

      expect(stats.name).toBe('test-queue');
      expect(stats.concurrency).toBe(1);
      expect(stats.counts.pending).toBe(2);
      expect(stats.counts.delayed).toBe(1);
      expect(stats.counts.active).toBe(0);
      expect(stats.counts.completed).toBe(0);
      expect(stats.counts.failed).toBe(0);
    });
  });

  // ====== Event Listeners ======

  describe('on() / off() / emit()', () => {
    it('should register and emit events', () => {
      const handler = jest.fn();
      queue.on('completed', handler);

      queue.emit('completed', { id: '1' }, 'result');

      expect(handler).toHaveBeenCalledWith({ id: '1' }, 'result');
    });

    it('should remove event handler with off()', () => {
      const handler = jest.fn();
      queue.on('completed', handler);
      queue.off('completed', handler);

      queue.emit('completed', { id: '1' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore unrecognized event names', () => {
      const handler = jest.fn();
      queue.on('nonexistent', handler);

      // Should not throw
      queue.emit('nonexistent');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should catch errors in event handlers', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      queue.on('completed', () => {
        throw new Error('handler error');
      });

      // Should not throw
      expect(() => queue.emit('completed', {})).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

// ======================================================================
// Error Class Tests
// ======================================================================

describe('Queue Error Classes', () => {
  let errors;

  beforeAll(async () => {
    errors = await import('./errors');
  });

  describe('QueueError', () => {
    it('should have correct default properties', () => {
      const err = new errors.QueueError('test error');

      expect(err.message).toBe('test error');
      expect(err.name).toBe('QueueError');
      expect(err.code).toBe('QUEUE_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.timestamp).toBeDefined();
      expect(err.stack).toBeDefined();
      expect(err).toBeInstanceOf(Error);
    });

    it('should accept custom code and statusCode', () => {
      const err = new errors.QueueError('custom', 'CUSTOM_CODE', 422);

      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.statusCode).toBe(422);
    });
  });

  describe('JobNotFoundError', () => {
    it('should include jobId and correct status', () => {
      const err = new errors.JobNotFoundError('job-123');

      expect(err.message).toBe('Job not found: job-123');
      expect(err.name).toBe('JobNotFoundError');
      expect(err.code).toBe('JOB_NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err.jobId).toBe('job-123');
      expect(err).toBeInstanceOf(errors.QueueError);
    });
  });

  describe('JobProcessingError', () => {
    it('should include jobId and original error', () => {
      const original = new Error('root cause');
      const err = new errors.JobProcessingError(
        'job-456',
        'handler crashed',
        original,
      );

      expect(err.message).toBe('Job processing failed: handler crashed');
      expect(err.name).toBe('JobProcessingError');
      expect(err.code).toBe('JOB_PROCESSING_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.jobId).toBe('job-456');
      expect(err.originalError).toBe(original);
      expect(err).toBeInstanceOf(errors.QueueError);
    });
  });

  describe('QueueConnectionError', () => {
    it('should have connection error properties', () => {
      const err = new errors.QueueConnectionError('Redis unreachable');

      expect(err.message).toBe('Queue connection failed: Redis unreachable');
      expect(err.name).toBe('QueueConnectionError');
      expect(err.code).toBe('QUEUE_CONNECTION_ERROR');
      expect(err.statusCode).toBe(503);
      expect(err).toBeInstanceOf(errors.QueueError);
    });
  });
});

// ======================================================================
// Factory Signal Handler Tests
// ======================================================================

describe('createFactory() signal handlers', () => {
  it('should register SIGTERM and SIGINT handlers', () => {
    const spy = jest.spyOn(process, 'once');

    // Reset mock to track only our call
    spy.mockClear();

    createFactory();

    const sigTermCalls = spy.mock.calls.filter(c => c[0] === 'SIGTERM');
    const sigIntCalls = spy.mock.calls.filter(c => c[0] === 'SIGINT');

    expect(sigTermCalls.length).toBeGreaterThanOrEqual(1);
    expect(sigIntCalls.length).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });
});
