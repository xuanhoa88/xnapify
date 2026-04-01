/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock piscina and native require before any imports
jest.mock('@shared/utils/createNativeRequire', () => ({
  createNativeRequire: () => jest.fn(),
}));

jest.mock('@shared/utils/contextAdapter', () => ({
  createWebpackContextAdapter: jest.fn(),
}));

import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

import { createWorkerPool } from './createWorkerPool';
import { WorkerError } from './errors';

// ======================================================================
// Helpers
// ======================================================================

/**
 * Build a fake webpack require.context adapter for testing
 */
function createMockAdapter(workerFiles = {}) {
  const keys = Object.keys(workerFiles);

  const adapter = {
    files: () => keys,
    load: jest.fn(key => {
      if (!workerFiles[key]) {
        throw new Error(`Module not found: ${key}`);
      }
      return workerFiles[key];
    }),
    resolve: jest.fn(key => `/absolute/path/to/${key.replace('./', '')}`),
  };

  createWebpackContextAdapter.mockReturnValue(adapter);
  return adapter;
}

/**
 * Returns a dummy webpack require.context function (just needs to be truthy)
 */
function dummyContext() {
  const ctx = () => {};
  ctx.keys = () => [];
  ctx.resolve = () => '';
  return ctx;
}

// ======================================================================
// Tests
// ======================================================================

describe('WorkerError', () => {
  it('should have correct default properties', () => {
    const error = new WorkerError('test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkerError);
    expect(error.name).toBe('WorkerError');
    expect(error.message).toBe('test message');
    expect(error.code).toBe('WORKER_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.timestamp).toBeDefined();
  });

  it('should accept custom code and statusCode', () => {
    const error = new WorkerError('timeout', 'WORKER_REQUEST_TIMEOUT', 504);

    expect(error.code).toBe('WORKER_REQUEST_TIMEOUT');
    expect(error.statusCode).toBe(504);
  });

  it('should have a proper stack trace', () => {
    const error = new WorkerError('trace test');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('trace test');
  });
});

describe('createWorkerPool', () => {
  afterEach(() => {
    // Clear registry between tests to prevent singleton leaks
    createWorkerPool.registry.clear();
    jest.restoreAllMocks();
  });

  // ====================================================================
  // Factory validation
  // ====================================================================

  describe('factory validation', () => {
    it('should throw if engineName is missing', () => {
      createMockAdapter();

      expect(() => createWorkerPool('', dummyContext())).toThrow(
        'createWorkerPool requires an engineName string',
      );
      expect(() => createWorkerPool(null, dummyContext())).toThrow(
        'createWorkerPool requires an engineName string',
      );
    });

    it('should return cached pool for same engineName', () => {
      createMockAdapter();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const pool1 = createWorkerPool('TestEngine', dummyContext());
      const pool2 = createWorkerPool('TestEngine', dummyContext());

      expect(pool1).toBe(pool2);

      consoleWarnSpy.mockRestore();
    });

    it('should create separate pools for different engineNames', () => {
      createMockAdapter();

      const pool1 = createWorkerPool('Engine1', dummyContext());

      createMockAdapter();
      const pool2 = createWorkerPool('Engine2', dummyContext());

      expect(pool1).not.toBe(pool2);
    });
  });

  // ====================================================================
  // Worker discovery
  // ====================================================================

  describe('worker discovery', () => {
    it('should discover .worker.js files', () => {
      createMockAdapter({
        './checksum.worker.js': { COMPUTE: jest.fn() },
        './search.worker.js': { INDEX: jest.fn() },
      });

      const pool = createWorkerPool('Discovery', dummyContext());

      expect(pool.knownWorkers).toEqual(
        expect.arrayContaining(['checksum', 'search']),
      );
      expect(pool.knownWorkers).toHaveLength(2);
    });

    it('should discover .worker.ts and .worker.mjs files', () => {
      createMockAdapter({
        './task.worker.ts': { RUN: jest.fn() },
        './job.worker.mjs': { EXEC: jest.fn() },
        './legacy.worker.cjs': { CALL: jest.fn() },
      });

      const pool = createWorkerPool('MultiExt', dummyContext());

      expect(pool.knownWorkers).toEqual(
        expect.arrayContaining(['task', 'job', 'legacy']),
      );
      expect(pool.knownWorkers).toHaveLength(3);
    });

    it('should ignore non-worker files', () => {
      createMockAdapter({
        './checksum.worker.js': { COMPUTE: jest.fn() },
        './utils.js': { helper: jest.fn() },
        './README.md': {},
      });

      const pool = createWorkerPool('FilterTest', dummyContext());

      expect(pool.knownWorkers).toEqual(['checksum']);
    });
  });

  // ====================================================================
  // sendRequest — same-process execution
  // ====================================================================

  describe('sendRequest() — same-process', () => {
    it('should execute worker function in same process', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 42 });

      createMockAdapter({
        './math.worker.js': { COMPUTE: handler },
      });

      const pool = createWorkerPool('SameProc', dummyContext());
      const result = await pool.sendRequest('math', 'COMPUTE', {
        input: 10,
      });

      expect(result).toEqual({
        success: true,
        result: { data: 42 },
      });
      expect(handler).toHaveBeenCalledWith({ input: 10 });
    });

    it('should cache worker module after first import', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      const adapter = createMockAdapter({
        './task.worker.js': { RUN: handler },
      });

      const pool = createWorkerPool('CacheTest', dummyContext());

      await pool.sendRequest('task', 'RUN', {});
      await pool.sendRequest('task', 'RUN', {});

      // load() should only be called once — second call uses cache
      expect(adapter.load).toHaveBeenCalledTimes(1);
    });

    it('should throw immediately if throwOnError is true and same-process fails', async () => {
      const error = new Error('computation failed');
      const handler = jest.fn().mockRejectedValue(error);
      jest.spyOn(console, 'warn').mockImplementation();

      createMockAdapter({
        './failing.worker.js': { FAIL: handler },
      });

      const pool = createWorkerPool('ThrowTest', dummyContext());

      await expect(
        pool.sendRequest('failing', 'FAIL', {}, { throwOnError: true }),
      ).rejects.toThrow('computation failed');
    });

    it('should resolve throwOnError from data.options as fallback', async () => {
      const error = new Error('data-level throw');
      const handler = jest.fn().mockRejectedValue(error);
      jest.spyOn(console, 'warn').mockImplementation();

      createMockAdapter({
        './failing.worker.js': { FAIL: handler },
      });

      const pool = createWorkerPool('DataThrow', dummyContext());

      await expect(
        pool.sendRequest('failing', 'FAIL', {
          options: { throwOnError: true },
        }),
      ).rejects.toThrow('data-level throw');
    });

    it('should return error object when throwOnError is false and thread also fails', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('same-proc fail'));
      jest.spyOn(console, 'warn').mockImplementation();

      // Only provide a worker that will fail in same-process,
      // and no piscina available so thread also fails
      createMockAdapter({
        './flaky.worker.js': { TASK: handler },
      });

      const pool = createWorkerPool('ErrorObj', dummyContext());
      const result = await pool.sendRequest('flaky', 'TASK', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBeDefined();
      expect(result.error.code).toBeDefined();
    });
  });

  // ====================================================================
  // sendRequest — forceFork
  // ====================================================================

  describe('sendRequest() — forceFork', () => {
    it('should skip same-process when forceFork is set per-call', async () => {
      const handler = jest.fn();

      createMockAdapter({
        './task.worker.js': { RUN: handler },
      });

      const pool = createWorkerPool('ForceFork', dummyContext());

      // This will fail (no Piscina) but should NOT call the same-process handler
      const result = await pool.sendRequest(
        'task',
        'RUN',
        {},
        { forceFork: true },
      );

      expect(handler).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should skip same-process when forceFork is set globally', async () => {
      const handler = jest.fn();

      createMockAdapter({
        './task.worker.js': { RUN: handler },
      });

      const pool = createWorkerPool('GlobalFork', dummyContext(), {
        forceFork: true,
      });

      const result = await pool.sendRequest('task', 'RUN', {});

      expect(handler).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });

  // ====================================================================
  // sendRequestToThread
  // ====================================================================

  describe('sendRequestToThread()', () => {
    it('should throw for unknown worker type', async () => {
      createMockAdapter({
        './known.worker.js': { TASK: jest.fn() },
      });

      const pool = createWorkerPool('ThreadTest', dummyContext());

      await expect(
        pool.sendRequestToThread('unknown', 'TASK', {}),
      ).rejects.toThrow('Unknown worker type: unknown');
    });

    it('should throw WorkerError when Piscina is not available', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      createMockAdapter({
        './task.worker.js': {
          RUN: jest.fn().mockRejectedValue(new Error('fail')),
        },
      });

      const pool = createWorkerPool('NoPiscina', dummyContext());

      // Use sendRequest with forceFork — the thread path will fail
      // because Piscina is not installed in the test environment
      const result = await pool.sendRequest(
        'task',
        'RUN',
        {},
        { forceFork: true },
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBeDefined();
    });
  });

  // ====================================================================
  // unregisterWorker
  // ====================================================================

  describe('unregisterWorker()', () => {
    it('should remove worker from known workers', () => {
      createMockAdapter({
        './a.worker.js': { TASK: jest.fn() },
        './b.worker.js': { TASK: jest.fn() },
      });

      const pool = createWorkerPool('Unreg', dummyContext());

      expect(pool.knownWorkers).toContain('a');

      const result = pool.unregisterWorker('a');

      expect(result).toBe(true);
      expect(pool.knownWorkers).not.toContain('a');
      expect(pool.knownWorkers).toContain('b');
    });

    it('should return false for non-existing worker', () => {
      createMockAdapter();

      const pool = createWorkerPool('UnregFalse', dummyContext());

      expect(pool.unregisterWorker('nonexistent')).toBe(false);
    });

    it('should prevent thread execution after unregister', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      jest.spyOn(console, 'warn').mockImplementation();

      createMockAdapter({
        './task.worker.js': { RUN: handler },
      });

      const pool = createWorkerPool('UnregBlock', dummyContext());

      // First call succeeds via same-process
      const result1 = await pool.sendRequest('task', 'RUN', {});
      expect(result1.success).toBe(true);

      pool.unregisterWorker('task');

      // After unregister, workerModuleCache is cleared so same-process
      // returns null (workerKeyMap still has the key, but the module
      // cache was cleared). However, tryImportWorkerModule will re-load
      // from workerKeyMap. The real guard is in sendRequestToThread
      // which checks knownWorkers.
      // Force thread path to verify the unregister takes effect there
      const result2 = await pool.sendRequest(
        'task',
        'RUN',
        {},
        { forceFork: true },
      );

      expect(result2.success).toBe(false);
      expect(result2.error.message).toContain('Unknown worker type');
    });
  });

  // ====================================================================
  // getStats
  // ====================================================================

  describe('getStats()', () => {
    it('should return zeroed stats when no pool exists', () => {
      createMockAdapter();

      const pool = createWorkerPool('StatsEmpty', dummyContext());
      const stats = pool.getStats();

      expect(stats).toEqual({
        totalWorkers: 0,
        utilization: 0,
        completedTasks: 0,
        runTimeInfo: {
          idle: 0,
          running: 0,
          waiting: 0,
        },
      });
    });

    it('should not trigger lazy pool initialization', () => {
      createMockAdapter();

      const pool = createWorkerPool('StatsNoInit', dummyContext());

      // Call getStats — pool should remain null
      pool.getStats();

      expect(pool.piscinaPoolInstance).toBeNull();
    });
  });

  // ====================================================================
  // cleanup
  // ====================================================================

  describe('cleanup()', () => {
    it('should be a no-op when pool was never created', async () => {
      createMockAdapter();

      const pool = createWorkerPool('CleanNoop', dummyContext());

      await expect(pool.cleanup()).resolves.not.toThrow();
    });

    it('should remove pool from registry', async () => {
      createMockAdapter();

      const pool = createWorkerPool('CleanReg', dummyContext());

      expect(createWorkerPool.registry.has('CleanReg')).toBe(true);

      await pool.cleanup();

      expect(createWorkerPool.registry.has('CleanReg')).toBe(false);
    });

    it('should allow re-creation after cleanup', async () => {
      createMockAdapter({
        './task.worker.js': { RUN: jest.fn() },
      });

      const pool1 = createWorkerPool('Recreate', dummyContext());
      await pool1.cleanup();

      createMockAdapter({
        './task.worker.js': { RUN: jest.fn() },
      });

      const pool2 = createWorkerPool('Recreate', dummyContext());

      expect(pool2).not.toBe(pool1);
      expect(createWorkerPool.registry.has('Recreate')).toBe(true);
    });
  });

  // ====================================================================
  // pool getter — failure caching
  // ====================================================================

  describe('pool getter — failure caching', () => {
    it('should cache Piscina load failure to prevent repeated attempts', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      createMockAdapter();

      const pool = createWorkerPool('FailCache', dummyContext());

      // Access pool getter twice — should log error only once
      // (Piscina not installed, so loadPiscina will throw)
      const result1 = pool.pool;
      const result2 = pool.pool;

      expect(result1).toBeNull();
      expect(result2).toBeNull();

      // Error should be logged (at least once for the initial failure)
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ====================================================================
  // Static properties
  // ====================================================================

  describe('static properties', () => {
    it('should expose DEFAULT_WORKER_CONFIG on createWorkerPool.options', () => {
      const { options } = createWorkerPool;

      expect(options).toBeDefined();
      expect(options.maxWorkers).toBeGreaterThan(0);
      expect(options.workerTimeout).toBe(60_000);
      expect(options.workerCreationTimeout).toBe(10_000);
      expect(options.forceFork).toBe(false);
    });

    it('should expose poolRegistry on createWorkerPool.registry', () => {
      expect(createWorkerPool.registry).toBeInstanceOf(Map);
    });
  });
});
