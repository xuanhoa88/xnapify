/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';

// In-memory worker module registry (populated by createMockWorkers)
let mockWorkerModules = {};

// Mock createNativeRequire — returns a require function that loads from
// our in-memory mock registry instead of the real filesystem.
// NOTE: jest.mock is hoisted, but the closure captures mockWorkerModules
// by reference so updates in createMockWorkers() are visible.
jest.mock('@shared/utils/createNativeRequire', () => ({
  createNativeRequire: () => {
    return filePath => {
      // Extract basename without importing path (jest.mock is hoisted)
      const basename = filePath.split('/').pop();
      if (mockWorkerModules[basename]) {
        return mockWorkerModules[basename];
      }
      throw new Error(`Mock require: module not found: ${filePath}`);
    };
  },
}));

import { createWorkerPool } from './createWorkerPool';
import { WorkerError } from './errors';

// ======================================================================
// Helpers
// ======================================================================

const FAKE_WORKERS_DIR = '/fake/bundle/workers';
const originalReaddirSync = fs.readdirSync;

/**
 * Set up mock workers for discovery and same-process execution.
 *
 * @param {Object} workerDefinitions - { workerName: { HANDLER: fn, ... } }
 */
function createMockWorkers(workerDefinitions = {}) {
  mockWorkerModules = {};
  const mockDirents = [];

  for (const [name, exports] of Object.entries(workerDefinitions)) {
    const filename = `${name}.worker.js`;
    mockWorkerModules[filename] = exports;
    mockDirents.push({
      name: filename,
      isFile: () => true,
      isDirectory: () => false,
      parentPath: FAKE_WORKERS_DIR,
      path: FAKE_WORKERS_DIR,
    });
  }

  // Mock fs.readdirSync — return our mock dirents for any workers/ dir
  jest.spyOn(fs, 'readdirSync').mockImplementation((dir, opts) => {
    if (typeof dir === 'string' && dir.endsWith('/workers')) {
      return mockDirents;
    }
    return originalReaddirSync(dir, opts);
  });
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
    it('should throw WorkerError if engineName is missing', () => {
      createMockWorkers();

      expect(() => createWorkerPool('')).toThrow(WorkerError);
      expect(() => createWorkerPool('')).toThrow(
        'createWorkerPool requires an engineName string',
      );
      expect(() => createWorkerPool(null)).toThrow(WorkerError);
      expect(() => createWorkerPool(null)).toThrow(
        'createWorkerPool requires an engineName string',
      );
    });

    it('should return cached pool for same engineName', () => {
      createMockWorkers();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const pool1 = createWorkerPool('TestEngine');
      const pool2 = createWorkerPool('TestEngine');

      expect(pool1).toBe(pool2);

      consoleWarnSpy.mockRestore();
    });

    it('should create separate pools for different engineNames', () => {
      createMockWorkers();

      const pool1 = createWorkerPool('Engine1');

      createMockWorkers();
      const pool2 = createWorkerPool('Engine2');

      expect(pool1).not.toBe(pool2);
    });
  });

  // ====================================================================
  // Worker discovery
  // ====================================================================

  describe('worker discovery', () => {
    it('should discover .worker.js files', () => {
      createMockWorkers({
        checksum: { COMPUTE: jest.fn() },
        search: { INDEX: jest.fn() },
      });

      const pool = createWorkerPool('Discovery');

      expect(pool.knownWorkers).toEqual(
        expect.arrayContaining(['checksum', 'search']),
      );
      expect(pool.knownWorkers).toHaveLength(2);
    });

    it('should return empty workers when directory does not exist', () => {
      // Don't mock readdirSync — let it fail naturally
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const pool = createWorkerPool('EmptyPool');

      expect(pool.knownWorkers).toEqual([]);
    });
  });

  // ====================================================================
  // sendRequest — same-process execution
  // ====================================================================

  describe('sendRequest() — same-process', () => {
    it('should execute worker function in same process', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 42 });

      createMockWorkers({
        math: { COMPUTE: handler },
      });

      const pool = createWorkerPool('SameProc');
      const result = await pool.sendRequest('math', 'COMPUTE', {
        input: 10,
      });

      expect(result).toEqual({
        success: true,
        result: { data: 42 },
      });
      expect(handler).toHaveBeenCalledWith({ input: 10 });
    });

    it('should throw immediately if throwOnError is true and same-process fails', async () => {
      const error = new Error('computation failed');
      const handler = jest.fn().mockRejectedValue(error);
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        failing: { FAIL: handler },
      });

      const pool = createWorkerPool('ThrowTest');

      await expect(
        pool.sendRequest('failing', 'FAIL', {}, { throwOnError: true }),
      ).rejects.toThrow('computation failed');
    });

    it('should resolve throwOnError from data.options as fallback', async () => {
      const error = new Error('data-level throw');
      const handler = jest.fn().mockRejectedValue(error);
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        failing: { FAIL: handler },
      });

      const pool = createWorkerPool('DataThrow');

      await expect(
        pool.sendRequest('failing', 'FAIL', {
          options: { throwOnError: true },
        }),
      ).rejects.toThrow('data-level throw');
    });

    it('should return error object when throwOnError is false and thread also fails', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('same-proc fail'));
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        flaky: { TASK: handler },
      });

      const pool = createWorkerPool('ErrorObj');
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

      createMockWorkers({
        task: { RUN: handler },
      });

      const pool = createWorkerPool('ForceFork');

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

      createMockWorkers({
        task: { RUN: handler },
      });

      const pool = createWorkerPool('GlobalFork', {
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
      createMockWorkers({
        known: { TASK: jest.fn() },
      });

      const pool = createWorkerPool('ThreadTest');

      await expect(
        pool.sendRequestToThread('unknown', 'TASK', {}),
      ).rejects.toThrow('Unknown worker type: unknown');
    });

    it('should throw WorkerError when Piscina is not available', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        task: {
          RUN: jest.fn().mockRejectedValue(new Error('fail')),
        },
      });

      const pool = createWorkerPool('NoPiscina');

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
      createMockWorkers({
        a: { TASK: jest.fn() },
        b: { TASK: jest.fn() },
      });

      const pool = createWorkerPool('Unreg');

      expect(pool.knownWorkers).toContain('a');

      const result = pool.unregisterWorker('a');

      expect(result).toBe(true);
      expect(pool.knownWorkers).not.toContain('a');
      expect(pool.knownWorkers).toContain('b');
    });

    it('should return false for non-existing worker', () => {
      createMockWorkers();

      const pool = createWorkerPool('UnregFalse');

      expect(pool.unregisterWorker('nonexistent')).toBe(false);
    });

    it('should prevent thread execution after unregister', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        task: { RUN: handler },
      });

      const pool = createWorkerPool('UnregBlock');

      // First call succeeds via same-process
      const result1 = await pool.sendRequest('task', 'RUN', {});
      expect(result1.success).toBe(true);

      pool.unregisterWorker('task');

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

    it('should prevent same-process execution after unregister', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        task: { RUN: handler },
      });

      const pool = createWorkerPool('UnregSameProc');

      // First call succeeds via same-process
      const result1 = await pool.sendRequest('task', 'RUN', {});
      expect(result1.success).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      pool.unregisterWorker('task');
      handler.mockClear();

      // After unregister, same-process path should also be blocked
      const result2 = await pool.sendRequest('task', 'RUN', {});

      expect(handler).not.toHaveBeenCalled();
      expect(result2.success).toBe(false);
    });

    it('should not execute unknown workerType via same-process path', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      createMockWorkers({
        known: { RUN: jest.fn().mockResolvedValue('ok') },
      });

      const pool = createWorkerPool('UnknownSameProc');

      // Unknown worker falls through to thread path which also fails
      const result = await pool.sendRequest('unknown', 'RUN', {});

      expect(result.success).toBe(false);
    });
  });

  // ====================================================================
  // getStats
  // ====================================================================

  describe('getStats()', () => {
    it('should return zeroed stats when no pool exists', () => {
      createMockWorkers();

      const pool = createWorkerPool('StatsEmpty');
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
      createMockWorkers();

      const pool = createWorkerPool('StatsNoInit');

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
      createMockWorkers();

      const pool = createWorkerPool('CleanNoop');

      await expect(pool.cleanup()).resolves.not.toThrow();
    });

    it('should remove pool from registry', async () => {
      createMockWorkers();

      const pool = createWorkerPool('CleanReg');

      expect(createWorkerPool.registry.has('CleanReg')).toBe(true);

      await pool.cleanup();

      expect(createWorkerPool.registry.has('CleanReg')).toBe(false);
    });

    it('should allow re-creation after cleanup', async () => {
      createMockWorkers({
        task: { RUN: jest.fn() },
      });

      const pool1 = createWorkerPool('Recreate');
      await pool1.cleanup();

      createMockWorkers({
        task: { RUN: jest.fn() },
      });

      const pool2 = createWorkerPool('Recreate');

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

      createMockWorkers();

      const pool = createWorkerPool('FailCache');

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
