/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

import { createFactory, WorkerPoolManager, WorkerError } from './index';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, '__tests__', 'fixtures');

// Mock piscina to avoid actual thread creation in unit tests.
jest.mock('piscina', () => {
  class MockPiscina {
    constructor(options = {}) {
      this.options = options;
      this.destroyed = false;
      this.completedCount = 0;
    }

    async run(data, opts) {
      if (this.destroyed) {
        throw new Error('Pool has been destroyed');
      }
      // Return a standardized mock result for testing
      return { data, filename: opts.filename, name: opts.name };
    }

    async destroy() {
      this.destroyed = true;
    }

    get threads() {
      return this.destroyed ? [] : [{ id: 1 }];
    }

    get completed() {
      return this.completedCount;
    }

    get utilization() {
      return 0;
    }

    get queueSize() {
      return 0;
    }
  }

  return MockPiscina;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[engine] Worker Pool', () => {
  let pool;

  beforeEach(() => {
    pool = new WorkerPoolManager({
      minThreads: 1,
      maxThreads: 4,
      idleTimeout: 5_000,
      taskTimeout: 5_000,
      maxQueueSize: 10,
    });
  });

  afterEach(async () => {
    await pool.cleanup();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor()', () => {
    it('should use default config when none provided', () => {
      const defaultPool = new WorkerPoolManager();
      expect(defaultPool.config.minThreads).toBeGreaterThanOrEqual(1);
      expect(defaultPool.config.maxThreads).toBeGreaterThanOrEqual(1);
      defaultPool.cleanup();
    });

    it('should clamp minThreads to maxThreads', () => {
      const clamped = new WorkerPoolManager({
        minThreads: 10,
        maxThreads: 2,
      });
      expect(clamped.config.minThreads).toBe(2);
      clamped.cleanup();
    });

    it('should create a piscina pool', () => {
      expect(pool.pool).toBeDefined();
      expect(pool.pool.options.minThreads).toBe(1);
      expect(pool.pool.options.maxThreads).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Worker Registration
  // -------------------------------------------------------------------------

  describe('registerWorker()', () => {
    it('should register and find workers', () => {
      pool.registerWorker('math', '/path/to/math.worker.js');
      expect(pool.hasWorker('math')).toBe(true);
      expect(pool.getWorkerNames()).toContain('math');
    });

    it('should unregister workers', () => {
      pool.registerWorker('math', '/path/to/math.worker.js');
      expect(pool.unregisterWorker('math')).toBe(true);
      expect(pool.hasWorker('math')).toBe(false);
    });

    it('should throw on invalid worker name', () => {
      expect(() => pool.registerWorker('', '/path')).toThrow(WorkerError);
      expect(() => pool.registerWorker(null, '/path')).toThrow(WorkerError);
    });

    it('should throw on invalid worker path', () => {
      expect(() => pool.registerWorker('test', '')).toThrow(WorkerError);
      expect(() => pool.registerWorker('test', null)).toThrow(WorkerError);
    });

    it('should throw on relative worker path', () => {
      expect(() => pool.registerWorker('test', './relative.js')).toThrow(
        WorkerError,
      );
      expect(() => pool.registerWorker('test', '../parent/path.js')).toThrow(
        WorkerError,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  describe('discoverWorkers()', () => {
    it('should discover *.worker.js files recursively', () => {
      const fs = require('fs');
      const workersDir = path.join(FIXTURES_DIR, 'workers');
      const nestedDir = path.join(workersDir, 'nested');

      // Create fixture worker files
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(
        path.join(workersDir, 'math.worker.js'),
        'module.exports.add = () => {};',
      );
      fs.writeFileSync(
        path.join(nestedDir, 'text.worker.js'),
        'module.exports.upper = () => {};',
      );

      pool.discoverWorkers(workersDir);

      expect(pool.hasWorker('math')).toBe(true);
      expect(pool.hasWorker('text')).toBe(true);
      expect(pool.getWorkerNames()).toEqual(
        expect.arrayContaining(['math', 'text']),
      );

      // Cleanup
      fs.unlinkSync(path.join(workersDir, 'math.worker.js'));
      fs.unlinkSync(path.join(nestedDir, 'text.worker.js'));
      try {
        fs.rmdirSync(nestedDir);
        fs.rmdirSync(workersDir);
        fs.rmdirSync(FIXTURES_DIR);
        fs.rmdirSync(path.dirname(FIXTURES_DIR));
      } catch {
        // Ignore if not empty
      }
    });

    it('should silently ignore missing directories', () => {
      // Should not throw or warn for ENOENT
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      pool.discoverWorkers('/nonexistent/path/workers');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should warn on name collisions and keep first registration', () => {
      const fs = require('fs');
      const workersDir = path.join(FIXTURES_DIR, 'collision');
      const groupsDir = path.join(workersDir, 'groups');
      const usersDir = path.join(workersDir, 'users');

      // Create two search.worker.js files in different directories
      fs.mkdirSync(groupsDir, { recursive: true });
      fs.mkdirSync(usersDir, { recursive: true });
      fs.writeFileSync(
        path.join(groupsDir, 'search.worker.js'),
        'module.exports.indexAll = () => {};',
      );
      fs.writeFileSync(
        path.join(usersDir, 'search.worker.js'),
        'module.exports.indexAll = () => {};',
      );

      const spy = jest.spyOn(console, 'warn').mockImplementation();
      pool.discoverWorkers(workersDir);

      // First registration wins
      expect(pool.hasWorker('search')).toBe(true);

      // Collision warning logged (single concatenated string)
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Name collision: "search"'),
      );
      spy.mockRestore();

      // Cleanup
      fs.unlinkSync(path.join(groupsDir, 'search.worker.js'));
      fs.unlinkSync(path.join(usersDir, 'search.worker.js'));
      try {
        fs.rmdirSync(groupsDir);
        fs.rmdirSync(usersDir);
        fs.rmdirSync(workersDir);
        fs.rmdirSync(FIXTURES_DIR);
        fs.rmdirSync(path.dirname(FIXTURES_DIR));
      } catch {
        // Ignore if not empty
      }
    });
  });

  // -------------------------------------------------------------------------
  // Run
  // -------------------------------------------------------------------------

  describe('run()', () => {
    it('should reject for unregistered worker', async () => {
      await expect(pool.run('unknown', 'fn', {})).rejects.toThrow(WorkerError);
      await expect(pool.run('unknown', 'fn', {})).rejects.toMatchObject({
        code: 'WORKER_NOT_FOUND',
      });
    });

    it('should reject after pool termination', async () => {
      await pool.cleanup();
      await expect(pool.run('test', 'fn', {})).rejects.toMatchObject({
        code: 'POOL_TERMINATED',
      });
    });

    it('should delegate to piscina with correct options', async () => {
      pool.registerWorker('math', '/path/to/math.worker.js');

      const result = await pool.run('math', 'fibonacci', { n: 10 });

      expect(result).toEqual({
        data: { n: 10 },
        filename: '/path/to/math.worker.js',
        name: 'fibonacci',
      });
    });

    it('should handle piscina errors as WorkerError', async () => {
      pool.registerWorker('math', '/path/to/math.worker.js');

      // Make the mock throw
      const originalRun = pool.pool.run.bind(pool.pool);
      pool.pool.run = async () => {
        throw new Error('Worker crashed');
      };

      await expect(pool.run('math', 'fn', {})).rejects.toMatchObject({
        code: 'WORKER_EXECUTION_ERROR',
      });

      pool.pool.run = originalRun;
    });

    it('should handle timeout via Promise.race', async () => {
      const shortPool = new WorkerPoolManager({
        minThreads: 1,
        maxThreads: 1,
        taskTimeout: 50, // 50ms
      });
      shortPool.registerWorker('slow', '/path/to/slow.worker.js');

      // Make mock run take forever
      shortPool.pool.run = () => new Promise(() => {}); // Never resolves

      await expect(shortPool.run('slow', 'fn', {})).rejects.toMatchObject({
        code: 'WORKER_TIMEOUT',
      });

      shortPool.pool.run = async () => ({});
      await shortPool.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('should return pool stats', () => {
      pool.registerWorker('math', '/path/to/math.worker.js');

      const stats = pool.getStats();

      expect(stats).toEqual({
        threads: {
          total: 1,
          idle: 1,
          active: 0,
          min: 1,
          max: 4,
        },
        tasks: {
          completed: 0,
          queued: 0,
        },
        workers: ['math'],
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup()', () => {
    it('should destroy the piscina pool', async () => {
      await pool.cleanup();
      expect(pool.pool.destroyed).toBe(true);
      expect(pool.terminated).toBe(true);
    });

    it('should be idempotent', async () => {
      await pool.cleanup();
      await pool.cleanup(); // Should not throw
      expect(pool.terminated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Factory
  // -------------------------------------------------------------------------

  describe('createFactory()', () => {
    it('should return WorkerPoolManager instance', () => {
      const instance = createFactory();
      expect(instance).toBeInstanceOf(WorkerPoolManager);
      instance.cleanup();
    });

    it('should register signal handlers', () => {
      const spy = jest.spyOn(process, 'once');
      const instance = createFactory();
      expect(spy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      spy.mockRestore();
      instance.cleanup();
    });
  });

  // -------------------------------------------------------------------------
  // WorkerError
  // -------------------------------------------------------------------------

  describe('WorkerError', () => {
    it('should have correct properties', () => {
      const error = new WorkerError('test', 'TEST_CODE', 404);
      expect(error.name).toBe('WorkerError');
      expect(error.message).toBe('test');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.timestamp).toBeDefined();
      expect(error).toBeInstanceOf(Error);
    });

    it('should use defaults for optional fields', () => {
      const error = new WorkerError('test');
      expect(error.code).toBe('WORKER_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });
});
