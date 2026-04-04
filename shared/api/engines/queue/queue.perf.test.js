/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Queue Engine Performance Tests
 *
 * Benchmarks both MemoryQueue and FileQueue across key operations.
 * Run with: npx jest queue.perf.test.js --no-coverage
 *
 * Results are logged as a table at the end of each suite.
 * Use these numbers as a baseline before/after refactoring.
 */

import fs from 'fs';
import path from 'path';

jest.mock('uuid');

// ======================================================================
// Helpers
// ======================================================================

/**
 * Measure async function execution time in ms
 * @param {Function} fn - Async function to benchmark
 * @returns {Promise<{result: *, durationMs: number}>}
 */
async function measure(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1e6;
  return { result, durationMs };
}

/**
 * Run a benchmark N times and return stats
 * @param {string} label - Benchmark label
 * @param {Function} fn - Async function to benchmark
 * @param {number} iterations - Number of runs
 * @returns {Promise<{label, min, max, avg, total, iterations}>}
 */
async function benchmark(label, fn, iterations = 1) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const { durationMs } = await measure(fn);
    times.push(durationMs);
  }

  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { label, min, max, avg, total, iterations };
}

/**
 * Format benchmark results as a table
 */
function formatTable(results) {
  const rows = results.map(r => ({
    Benchmark: r.label,
    Iterations: r.iterations,
    'Total (ms)': r.total.toFixed(2),
    'Avg (ms)': r.avg.toFixed(2),
    'Min (ms)': r.min.toFixed(2),
    'Max (ms)': r.max.toFixed(2),
  }));
  console.table(rows);
}

// ======================================================================
// MemoryQueue Performance
// ======================================================================

describe('MemoryQueue Performance', () => {
  let MemoryQueue;
  let queue;
  const results = [];

  beforeAll(async () => {
    const mod = await import('./adapters/memory');
    MemoryQueue = mod.default;
  });

  beforeEach(() => {
    queue = new MemoryQueue({
      name: 'perf-memory',
      concurrency: 10,
      defaultJobOptions: { removeOnComplete: false },
    });
  });

  afterEach(async () => {
    await queue.close();
  });

  afterAll(() => {
    console.log('\n📊 MemoryQueue Benchmark Results:');
    formatTable(results);
  });

  it('add() — 1000 jobs', async () => {
    const r = await benchmark('add() x1000', async () => {
      for (let i = 0; i < 1000; i++) {
        await queue.add(`event-${i}`, { index: i });
      }
    });
    results.push(r);
    expect(await queue.getJobs()).toHaveLength(1000);
  });

  it('addBulk() — 1000 jobs', async () => {
    const jobs = Array.from({ length: 1000 }, (_, i) => ({
      name: `event-${i}`,
      data: { index: i },
    }));

    const r = await benchmark('addBulk() x1000', async () => {
      await queue.addBulk(jobs);
    });
    results.push(r);
    expect(await queue.getJobs()).toHaveLength(1000);
  });

  it('getJob() — lookup 1000 jobs by ID', async () => {
    const ids = [];
    for (let i = 0; i < 1000; i++) {
      const job = await queue.add(`event-${i}`, { index: i });
      ids.push(job.id);
    }

    const r = await benchmark('getJob() x1000', async () => {
      for (const id of ids) {
        await queue.getJob(id);
      }
    });
    results.push(r);
    expect(r.total).toBeLessThan(1000); // Should be fast — Map lookup
  });

  it('getJobsByStatus() — 1000 pending jobs', async () => {
    for (let i = 0; i < 1000; i++) {
      await queue.add(`event-${i}`, {});
    }

    const r = await benchmark('getJobsByStatus() x10', async () => {
      for (let i = 0; i < 10; i++) {
        await queue.getJobsByStatus('pending');
      }
    });
    results.push(r);
  });

  it('processNext() — drain 100 jobs serially', async () => {
    for (let i = 0; i < 100; i++) {
      await queue.add(`event-${i}`, { index: i });
    }

    let processed = 0;
    queue.on('completed', () => {
      processed++;
    });

    const r = await benchmark('process+drain x100', async () => {
      queue.process(async job => {
        return { done: job.data.index };
      });
      // Wait for all jobs to complete
      const start = Date.now();
      while (processed < 100 && Date.now() - start < 5000) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
    results.push(r);
    expect(processed).toBe(100);
  });

  it('priority sort — 1000 mixed-priority jobs', async () => {
    // Pause to prevent processing
    queue.pause();

    for (let i = 0; i < 1000; i++) {
      await queue.add(
        `event-${i}`,
        {},
        { priority: Math.floor(Math.random() * 100) },
      );
    }

    const r = await benchmark('priority sort x10', async () => {
      for (let i = 0; i < 10; i++) {
        Array.from(queue.jobs.values())
          .filter(j => j.status === 'pending')
          .sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.createdAt - b.createdAt;
          });
      }
    });
    results.push(r);
  });

  it('clean() — 1000 completed jobs', async () => {
    for (let i = 0; i < 1000; i++) {
      const job = await queue.add(
        `event-${i}`,
        {},
        { removeOnComplete: false },
      );
      job.status = 'completed';
      job.completedAt = Date.now() - 10000;
    }

    const r = await benchmark('clean() x1000 completed', async () => {
      await queue.clean('completed', 0);
    });
    results.push(r);
    expect(await queue.getJobs()).toHaveLength(0);
  });

  it('removeJob() — 500 jobs', async () => {
    const ids = [];
    for (let i = 0; i < 500; i++) {
      const job = await queue.add(`event-${i}`, {});
      ids.push(job.id);
    }

    const r = await benchmark('removeJob() x500', async () => {
      for (const id of ids) {
        await queue.removeJob(id);
      }
    });
    results.push(r);
    expect(await queue.getJobs()).toHaveLength(0);
  });

  it('getStats() — with 1000 mixed-status jobs', async () => {
    for (let i = 0; i < 1000; i++) {
      const job = await queue.add(
        `event-${i}`,
        {},
        { removeOnComplete: false },
      );
      if (i % 3 === 0) {
        job.status = 'completed';
        job.completedAt = Date.now();
      }
      if (i % 5 === 0) {
        job.status = 'failed';
        job.failedAt = Date.now();
      }
    }

    const r = await benchmark('getStats() x100', async () => {
      for (let i = 0; i < 100; i++) {
        await queue.getStats();
      }
    });
    results.push(r);
  });
});

// ======================================================================
// FileQueue Performance
// ======================================================================

describe('FileQueue Performance', () => {
  let FileQueue;
  let queue;
  const TEST_DATA_DIR = path.join(process.cwd(), '.data', 'perf-queues');
  const results = [];

  beforeAll(() => {
    jest.resetModules();
    const uuidMock = require('uuid');
    uuidMock.resetCounter();
    FileQueue = require('./adapters/file').default;
  });

  beforeEach(() => {
    queue = new FileQueue({
      name: 'perf-file',
      dataDir: TEST_DATA_DIR,
      pollInterval: 30,
      concurrency: 5,
      defaultJobOptions: { removeOnComplete: false, attempts: 1 },
    });
  });

  afterEach(async () => {
    if (queue) {
      await queue.close();
    }
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  afterAll(() => {
    console.log('\n📊 FileQueue Benchmark Results:');
    formatTable(results);
  });

  it('add() — 100 jobs (file I/O)', async () => {
    const r = await benchmark('add() x100', async () => {
      for (let i = 0; i < 100; i++) {
        await queue.add(`event-${i}`, { index: i });
      }
    });
    results.push(r);

    const pendingDir = path.join(TEST_DATA_DIR, 'perf-file', 'pending');
    expect(fs.readdirSync(pendingDir).length).toBe(100);
  });

  it('addBulk() — 100 jobs', async () => {
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      name: `event-${i}`,
      data: { index: i },
    }));

    const r = await benchmark('addBulk() x100', async () => {
      await queue.addBulk(jobs);
    });
    results.push(r);
  });

  it('getJob() — lookup across 100 jobs (full scan)', async () => {
    const ids = [];
    for (let i = 0; i < 100; i++) {
      const job = await queue.add(`event-${i}`, { index: i });
      ids.push(job.id);
    }

    // Lookup 10 random jobs to benchmark the scan
    const sampleIds = ids.slice(0, 10);

    const r = await benchmark('getJob() x10 (scan)', async () => {
      for (const id of sampleIds) {
        await queue.getJob(id);
      }
    });
    results.push(r);
  });

  it('getJobsByStatus() — 100 pending jobs', async () => {
    for (let i = 0; i < 100; i++) {
      await queue.add(`event-${i}`, {});
    }

    const r = await benchmark('getJobsByStatus() x5', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.getJobsByStatus('pending');
      }
    });
    results.push(r);
  });

  it('processNext() — drain 50 jobs', async () => {
    for (let i = 0; i < 50; i++) {
      await queue.add(`event-${i}`, { index: i });
    }

    let processed = 0;
    queue.on('completed', () => {
      processed++;
    });

    const r = await benchmark('process+drain x50', async () => {
      queue.process(async job => {
        return { done: job.data.index };
      });
      const start = Date.now();
      while (processed < 50 && Date.now() - start < 10000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });
    results.push(r);
    expect(processed).toBe(50);
  });

  it('removeJob() — 50 jobs', async () => {
    const ids = [];
    for (let i = 0; i < 50; i++) {
      const job = await queue.add(`event-${i}`, {});
      ids.push(job.id);
    }

    const r = await benchmark('removeJob() x50', async () => {
      for (const id of ids) {
        await queue.removeJob(id);
      }
    });
    results.push(r);
  });

  it('getStats() — with 100 jobs', async () => {
    for (let i = 0; i < 100; i++) {
      await queue.add(`event-${i}`, {});
    }

    const r = await benchmark('getStats() x10', async () => {
      for (let i = 0; i < 10; i++) {
        await queue.getStats();
      }
    });
    results.push(r);
  });

  it('clean() — 50 completed jobs', async () => {
    for (let i = 0; i < 50; i++) {
      await queue.add(`event-${i}`, {});
    }

    let processed = 0;
    queue.on('completed', () => {
      processed++;
    });

    queue.process(async () => 'done');

    const start = Date.now();
    while (processed < 50 && Date.now() - start < 10000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const r = await benchmark('clean() x50 completed', async () => {
      await queue.clean('completed', 0);
    });
    results.push(r);
  });

  it('crash recovery — 50 stale active jobs', async () => {
    // Prepare stale jobs directly in active/
    const activeDir = path.join(TEST_DATA_DIR, 'recovery-perf', 'active');
    const dirs = ['pending', 'active', 'completed', 'failed', 'delayed'];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(TEST_DATA_DIR, 'recovery-perf', dir), {
        recursive: true,
      });
    }
    fs.mkdirSync(path.join(TEST_DATA_DIR, 'recovery-perf', '.locks'), {
      recursive: true,
    });

    for (let i = 0; i < 50; i++) {
      const staleJob = {
        id: `stale-${i}`,
        name: 'stale-task',
        status: 'active',
        priority: 0,
        createdAt: Date.now() - 10000,
        attempts: 1,
      };
      const filename = `9999-${String(staleJob.createdAt).padStart(15, '0')}-stale-${i}.json`;
      fs.writeFileSync(
        path.join(activeDir, filename),
        JSON.stringify(staleJob),
      );
    }

    const r = await benchmark('crash recovery x50', async () => {
      const recoveryQueue = new FileQueue({
        name: 'recovery-perf',
        dataDir: TEST_DATA_DIR,
      });
      await recoveryQueue.close();
    });
    results.push(r);

    // Verify recovery happened
    const pendingDir = path.join(TEST_DATA_DIR, 'recovery-perf', 'pending');
    expect(fs.readdirSync(pendingDir).length).toBe(50);
    expect(fs.readdirSync(activeDir).length).toBe(0);
  });
});

// ======================================================================
// Comparative Summary
// ======================================================================

describe('Adapter Comparison', () => {
  let MemoryQueue;
  let FileQueue;
  const TEST_DATA_DIR = path.join(process.cwd(), '.data', 'cmp-queues');

  beforeAll(async () => {
    jest.resetModules();
    const uuidMock = require('uuid');
    uuidMock.resetCounter();

    const memMod = await import('./adapters/memory');
    MemoryQueue = memMod.default;
    FileQueue = require('./adapters/file').default;
  });

  afterAll(() => {
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore
    }
  });

  it('should compare add() throughput between adapters', async () => {
    const memQueue = new MemoryQueue({ name: 'cmp-mem', concurrency: 1 });
    const fileQueue = new FileQueue({
      name: 'cmp-file',
      dataDir: TEST_DATA_DIR,
      concurrency: 1,
    });

    const count = 200;

    const memResult = await measure(async () => {
      for (let i = 0; i < count; i++) {
        await memQueue.add(`event-${i}`, { i });
      }
    });

    const fileResult = await measure(async () => {
      for (let i = 0; i < count; i++) {
        await fileQueue.add(`event-${i}`, { i });
      }
    });

    const ratio = fileResult.durationMs / Math.max(memResult.durationMs, 0.01);

    console.log('\n📊 Adapter Comparison: add() x' + count);
    console.table([
      {
        Adapter: 'MemoryQueue',
        'Duration (ms)': memResult.durationMs.toFixed(2),
      },
      {
        Adapter: 'FileQueue',
        'Duration (ms)': fileResult.durationMs.toFixed(2),
      },
      { Adapter: 'Ratio', 'Duration (ms)': `${ratio.toFixed(1)}x slower` },
    ]);

    // FileQueue should be within 500x of memory (file I/O is inherently slower)
    expect(ratio).toBeLessThan(500);

    await memQueue.close();
    await fileQueue.close();
  });
});
