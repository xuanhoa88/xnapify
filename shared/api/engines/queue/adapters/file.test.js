/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { JOB_STATUS } from '../utils/constants.js';

const require = createRequire(import.meta.url);

// ============================================================================
// Crash windows in the recovery paths
//
// Every transition in this adapter writes the destination before removing the
// source, so a process killed between the two leaves a duplicate (at-least-once
// delivery) rather than a hole. These tests kill the process — by throwing out
// of the first durable write — at exactly the points where that rule used to be
// broken, and assert the job is still there afterwards.
// ============================================================================

describe('FileQueue crash-window recovery', () => {
  let FileQueue;
  const DATA_DIR = path.join(process.cwd(), '.xnapify', 'test-queues-recovery');
  const opened = [];

  const make = (options = {}) => {
    const q = new FileQueue({
      name: 'recovery',
      dataDir: DATA_DIR,
      pollInterval: 50,
      // These tests exercise recovery mechanics, not the durable write path.
      // fsync is a full hardware flush (tens of ms per call on macOS) and the
      // durability guarantees are covered by the suite in ../fileQueue.test.js.
      fsync: false,
      ...options,
    });
    opened.push(q);
    return q;
  };

  // A complete job record, so the fixtures exercise the same shape createJob()
  // produces rather than a minimal one the adapter happens to tolerate.
  const jobFixture = (overrides = {}) => ({
    id: 'job-1',
    name: 'task',
    data: {},
    queue: 'recovery',
    status: JOB_STATUS.PENDING,
    priority: 0,
    attempts: 0,
    maxAttempts: 2,
    backoff: 10,
    delay: 0,
    removeOnComplete: false,
    removeOnFail: false,
    progress: 0,
    result: null,
    error: null,
    createdAt: Date.now() - 60_000,
    processedAt: null,
    completedAt: null,
    failedAt: null,
    scheduledFor: null,
    ...overrides,
  });

  const seed = (q, status, job) => {
    const filename = q.buildFilename(job);
    fs.writeFileSync(q.jobPath(status, filename), JSON.stringify(job), 'utf8');
    return filename;
  };

  // Let the next durable write land and then kill the process on the spot, so
  // the step that removes the old copy never runs.
  const dieAfterNextWrite = q => {
    const boom = Object.assign(new Error('killed'), { code: 'EIO' });
    const write = q.writeJob.bind(q);
    const writeSync = q.writeJobSync.bind(q);
    jest.spyOn(q, 'writeJob').mockImplementation(async (status, job) => {
      await write(status, job);
      throw boom;
    });
    jest
      .spyOn(q, 'writeJobSync')
      .mockImplementation((status, job, filename) => {
        writeSync(status, job, filename);
        throw boom;
      });
  };

  beforeEach(() => {
    jest.resetModules();
    FileQueue = require('./file.js').default;
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    while (opened.length) {
      await opened.pop().close();
    }
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  // ==================================================================
  // Delayed promotion
  // ==================================================================

  it('keeps a due delayed job promotable when the promotion is interrupted', async () => {
    const q = make();
    const job = jobFixture({
      id: 'due-1',
      status: JOB_STATUS.DELAYED,
      scheduledFor: Date.now() - 1000,
    });
    const filename = seed(q, 'delayed', job);
    jest.spyOn(console, 'error').mockImplementation();

    dieAfterNextWrite(q);
    await q.promoteExpiredDelayed();
    jest.restoreAllMocks();

    // Half a promotion must leave a duplicate, not a delayed/ record that no
    // longer describes a delayed job.
    expect(fs.existsSync(q.jobPath('pending', filename))).toBe(true);
    const stranded = JSON.parse(
      fs.readFileSync(q.jobPath('delayed', filename), 'utf8'),
    );
    expect(stranded.scheduledFor).toBe(job.scheduledFor);
    expect(stranded.status).toBe(JOB_STATUS.DELAYED);

    await q.promoteExpiredDelayed();

    const pending = await q.getJobsByStatus('pending');
    expect(pending.map(j => j.id)).toEqual([job.id]);
    expect(pending[0].status).toBe(JOB_STATUS.PENDING);
    expect(await q.getJobsByStatus('delayed')).toHaveLength(0);
  });

  it('keeps a due delayed job promotable when boot promotion is interrupted', async () => {
    const q = make();
    const job = jobFixture({
      id: 'due-2',
      status: JOB_STATUS.DELAYED,
      scheduledFor: Date.now() - 1000,
    });
    const filename = seed(q, 'delayed', job);
    jest.spyOn(console, 'error').mockImplementation();

    dieAfterNextWrite(q);
    q.promoteExpiredDelayedSync();
    jest.restoreAllMocks();

    expect(fs.existsSync(q.jobPath('pending', filename))).toBe(true);
    const stranded = JSON.parse(
      fs.readFileSync(q.jobPath('delayed', filename), 'utf8'),
    );
    expect(stranded.scheduledFor).toBe(job.scheduledFor);

    q.promoteExpiredDelayedSync();

    const pending = await q.getJobsByStatus('pending');
    expect(pending.map(j => j.id)).toEqual([job.id]);
    expect(await q.getJobsByStatus('delayed')).toHaveLength(0);
  });

  it('promotes a delayed job that carries no due time', async () => {
    const q = make();
    const job = jobFixture({ id: 'undated-1', status: JOB_STATUS.DELAYED });
    seed(q, 'delayed', job);

    await q.promoteExpiredDelayed();

    expect(await q.getJobsByStatus('delayed')).toHaveLength(0);
    const pending = await q.getJobsByStatus('pending');
    expect(pending.map(j => j.id)).toEqual([job.id]);
    expect(pending[0].status).toBe(JOB_STATUS.PENDING);
  });

  it('promotes a delayed job that carries no due time on boot', () => {
    const q = make();
    const job = jobFixture({ id: 'undated-2', status: JOB_STATUS.DELAYED });
    const filename = seed(q, 'delayed', job);

    const booted = make();

    expect(fs.existsSync(booted.jobPath('delayed', filename))).toBe(false);
    expect(fs.existsSync(booted.jobPath('pending', filename))).toBe(true);
  });

  // ==================================================================
  // Dead-lettering an abandoned job that already reached a terminal state
  // ==================================================================

  it('keeps the recorded error when an abandoned copy duplicates a failed job', async () => {
    const q = make();
    const base = jobFixture({ id: 'dup-1', maxAttempts: 1, attempts: 1 });
    const filename = q.buildFilename(base);
    seed(q, 'failed', {
      ...base,
      status: JOB_STATUS.FAILED,
      failedAt: Date.now(),
      error: { message: 'handler exploded', stack: 'at handler' },
    });
    seed(q, 'active', {
      ...base,
      status: JOB_STATUS.ACTIVE,
      processedAt: Date.now(),
    });

    const events = [];
    q.on('failed', job => events.push(job));

    await q.recoverStaleActive();

    const failed = await q.getJobsByStatus('failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].error.message).toBe('handler exploded');
    expect(fs.existsSync(q.jobPath('active', filename))).toBe(false);
    expect(q.stats).toEqual({ processed: 0, failed: 0, completed: 0 });
    expect(events).toHaveLength(0);
  });

  it('does not dead-letter an abandoned copy of a job that completed', async () => {
    const q = make();
    const base = jobFixture({ id: 'dup-2', maxAttempts: 1, attempts: 1 });
    const filename = q.buildFilename(base);
    seed(q, 'completed', {
      ...base,
      status: JOB_STATUS.COMPLETED,
      completedAt: Date.now(),
      result: 'ok',
      progress: 100,
    });
    seed(q, 'active', {
      ...base,
      status: JOB_STATUS.ACTIVE,
      processedAt: Date.now(),
    });

    const events = [];
    q.on('failed', job => events.push(job));

    await q.recoverStaleActive();

    expect(await q.getJobsByStatus('failed')).toHaveLength(0);
    const completed = await q.getJobsByStatus('completed');
    expect(completed.map(j => j.id)).toEqual([base.id]);
    expect(completed[0].result).toBe('ok');
    expect(fs.existsSync(q.jobPath('active', filename))).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('keeps the recorded error when boot recovery finds the duplicate', async () => {
    const q = make();
    const base = jobFixture({ id: 'dup-3', maxAttempts: 1, attempts: 1 });
    const filename = q.buildFilename(base);
    seed(q, 'failed', {
      ...base,
      status: JOB_STATUS.FAILED,
      failedAt: Date.now(),
      error: { message: 'handler exploded', stack: 'at handler' },
    });
    seed(q, 'active', {
      ...base,
      status: JOB_STATUS.ACTIVE,
      processedAt: Date.now(),
    });

    const booted = make();

    const failed = await booted.getJobsByStatus('failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].error.message).toBe('handler exploded');
    expect(fs.existsSync(booted.jobPath('active', filename))).toBe(false);
    expect(booted.stats).toEqual({ processed: 0, failed: 0, completed: 0 });
  });
});
