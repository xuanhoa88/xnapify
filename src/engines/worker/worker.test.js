/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  WorkerError,
  createWorkerHandler,
  unregisterWorkerHandler,
  getWorkerHandler,
  isWorkerHandlerActive,
  setupWorkerProcess,
  unregisterWorkerProcess,
  getWorkerProcess,
  isWorkerProcessActive,
  createWorkerPool,
} from '.';

describe('Worker Engine', () => {
  describe('WorkerError', () => {
    it('should create error with message, code, and statusCode', () => {
      const error = new WorkerError('Test error', 'TEST_CODE', 400);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('WorkerError');
    });

    it('should use default code and statusCode', () => {
      const error = new WorkerError('Test error');

      expect(error.code).toBe('WORKER_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should have timestamp', () => {
      const error = new WorkerError('Test error');

      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      expect(() => new Date(error.timestamp)).not.toThrow();
    });

    it('should have stack trace', () => {
      const error = new WorkerError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('WorkerError');
      expect(error.stack).toContain('Test error');
    });
  });

  describe('createWorkerHandler', () => {
    afterEach(() => {
      // Clean up any registered handlers
      unregisterWorkerHandler('TEST_TYPE');
      unregisterWorkerHandler('PROCESS_DATA');
      unregisterWorkerHandler('ERROR_TYPE');
    });

    it('should create a worker handler function', () => {
      const processFunction = async data => ({ result: data });
      const handler = createWorkerHandler(processFunction, 'TEST_TYPE');

      expect(typeof handler).toBe('function');
      expect(handler.expectedType).toBe('TEST_TYPE');
      expect(handler.isActive).toBe(true);
    });

    it('should process request with expected message type', async () => {
      const processFunction = async data => ({ processed: data.value * 2 });
      const handler = createWorkerHandler(processFunction, 'PROCESS_DATA');

      const result = await handler({
        id: 1,
        type: 'PROCESS_DATA',
        data: { value: 5 },
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
      expect(result.result).toEqual({ processed: 10 });
    });

    it('should reject request with unexpected message type', async () => {
      const processFunction = async data => ({ result: data });
      const handler = createWorkerHandler(processFunction, 'TEST_TYPE');

      const result = await handler({
        id: 1,
        type: 'WRONG_TYPE',
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNEXPECTED_TYPE');
      expect(result.error.message).toContain('Unexpected message type');
    });

    it('should handle errors from process function', async () => {
      const processFunction = async () => {
        throw new Error('Processing failed');
      };
      const handler = createWorkerHandler(processFunction, 'ERROR_TYPE');

      const result = await handler({
        id: 1,
        type: 'ERROR_TYPE',
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Processing failed');
      expect(result.error.code).toBe('WORKER_ERROR');
      expect(result.error.stack).toBeDefined();
    });

    it('should handle errors with custom code', async () => {
      const processFunction = async () => {
        const error = new Error('Custom error');
        error.code = 'CUSTOM_CODE';
        throw error;
      };
      const handler = createWorkerHandler(processFunction, 'ERROR_TYPE');

      const result = await handler({
        id: 1,
        type: 'ERROR_TYPE',
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CUSTOM_CODE');
    });

    it('should unregister via handler method', () => {
      const processFunction = async data => ({ result: data });
      const handler = createWorkerHandler(processFunction, 'TEST_TYPE');

      expect(handler.isActive).toBe(true);
      expect(getWorkerHandler('TEST_TYPE')).toBe(handler);

      const unregistered = handler.unregister();

      expect(unregistered).toBe(true);
      expect(handler.isActive).toBe(false);
      expect(getWorkerHandler('TEST_TYPE')).toBeNull();
    });

    it('should unregister via external function', () => {
      const processFunction = async data => ({ result: data });
      const handler = createWorkerHandler(processFunction, 'TEST_TYPE');

      expect(isWorkerHandlerActive('TEST_TYPE')).toBe(true);

      const unregistered = unregisterWorkerHandler('TEST_TYPE');

      expect(unregistered).toBe(true);
      expect(handler.isActive).toBe(false);
      expect(isWorkerHandlerActive('TEST_TYPE')).toBe(false);
    });

    it('should return false when unregistering non-existent handler', () => {
      const unregistered = unregisterWorkerHandler('NON_EXISTENT');

      expect(unregistered).toBe(false);
    });

    it('should get registered handler', () => {
      const processFunction = async data => ({ result: data });
      const handler = createWorkerHandler(processFunction, 'TEST_TYPE');

      const retrieved = getWorkerHandler('TEST_TYPE');

      expect(retrieved).toBe(handler);
    });

    it('should return null for non-existent handler', () => {
      const retrieved = getWorkerHandler('NON_EXISTENT');

      expect(retrieved).toBeNull();
    });

    it('should check if handler is active', () => {
      const processFunction = async data => ({ result: data });
      createWorkerHandler(processFunction, 'TEST_TYPE');

      expect(isWorkerHandlerActive('TEST_TYPE')).toBe(true);
      expect(isWorkerHandlerActive('NON_EXISTENT')).toBe(false);

      unregisterWorkerHandler('TEST_TYPE');

      expect(isWorkerHandlerActive('TEST_TYPE')).toBe(false);
    });
  });

  describe('setupWorkerProcess', () => {
    afterEach(() => {
      // Clean up any registered process handlers
      unregisterWorkerProcess('TestWorker');
      unregisterWorkerProcess('ErrorWorker');
    });

    it('should return no-op cleanup when not child process', () => {
      const originalSend = process.send;
      delete process.send; // Temporarily remove to simulate non-child process

      const processFunction = async data => ({ result: data });
      const cleanup = setupWorkerProcess(
        processFunction,
        'TEST_TYPE',
        'TestWorker',
      );

      expect(typeof cleanup).toBe('function');
      expect(isWorkerProcessActive('TestWorker')).toBe(false);

      // Restore
      if (originalSend) {
        process.send = originalSend;
      }
    });

    it('should unregister worker process', () => {
      // Mock child process environment
      const originalSend = process.send;
      const messages = [];
      process.send = msg => messages.push(msg);

      const processFunction = async data => ({ result: data });
      setupWorkerProcess(processFunction, 'TEST_TYPE', 'TestWorker');

      expect(isWorkerProcessActive('TestWorker')).toBe(true);

      const unregistered = unregisterWorkerProcess('TestWorker');

      expect(unregistered).toBe(true);
      expect(isWorkerProcessActive('TestWorker')).toBe(false);

      // Restore
      if (originalSend) {
        process.send = originalSend;
      } else {
        delete process.send;
      }
    });

    it('should return false when unregistering non-existent process', () => {
      const unregistered = unregisterWorkerProcess('NON_EXISTENT');

      expect(unregistered).toBe(false);
    });

    it('should get registered worker process', () => {
      // Mock child process environment
      const originalSend = process.send;
      const messages = [];
      process.send = msg => messages.push(msg);

      const processFunction = async data => ({ result: data });
      setupWorkerProcess(processFunction, 'TEST_TYPE', 'TestWorker');

      const handlers = getWorkerProcess('TestWorker');

      expect(handlers).toBeDefined();
      expect(handlers).toHaveProperty('message');
      expect(handlers).toHaveProperty('uncaughtException');
      expect(handlers).toHaveProperty('unhandledRejection');

      unregisterWorkerProcess('TestWorker');

      // Restore
      if (originalSend) {
        process.send = originalSend;
      } else {
        delete process.send;
      }
    });

    it('should return null for non-existent process', () => {
      const handlers = getWorkerProcess('NON_EXISTENT');

      expect(handlers).toBeNull();
    });

    it('should check if worker process is active', () => {
      // Mock child process environment
      const originalSend = process.send;
      const messages = [];
      process.send = msg => messages.push(msg);

      const processFunction = async data => ({ result: data });
      setupWorkerProcess(processFunction, 'TEST_TYPE', 'TestWorker');

      expect(isWorkerProcessActive('TestWorker')).toBe(true);
      expect(isWorkerProcessActive('NON_EXISTENT')).toBe(false);

      unregisterWorkerProcess('TestWorker');

      expect(isWorkerProcessActive('TestWorker')).toBe(false);

      // Restore
      if (originalSend) {
        process.send = originalSend;
      } else {
        delete process.send;
      }
    });
  });

  describe('createWorkerPool', () => {
    let mockContext;
    let workerPool;

    beforeEach(() => {
      // Create a mock require.context
      mockContext = jest.fn(key => {
        if (key === './test.worker.js') {
          return {
            default: createWorkerHandler(
              async data => ({ processed: data.value * 2 }),
              'TEST_WORKER',
            ),
          };
        }
        if (key === './compute.worker.js') {
          return {
            default: createWorkerHandler(
              async data => ({ result: data.a + data.b }),
              'COMPUTE',
            ),
          };
        }
        throw new Error(`Module not found: ${key}`);
      });

      mockContext.keys = jest.fn(() => [
        './test.worker.js',
        './compute.worker.js',
      ]);

      mockContext.resolve = jest.fn(key => {
        const basePath = '/fake/path/to/workers';
        return `${basePath}/${key.replace('./', '')}`;
      });
    });

    afterEach(() => {
      if (workerPool) {
        workerPool.cleanup();
      }
      // Clean up handlers
      unregisterWorkerHandler('TEST_WORKER');
      unregisterWorkerHandler('COMPUTE');
    });

    it('should create worker pool and discover workers', () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      expect(workerPool).toBeDefined();
      expect(workerPool.workerPools).toHaveProperty('test');
      expect(workerPool.workerPools).toHaveProperty('compute');
    });

    it('should send request using same-process execution', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const result = await workerPool.sendRequest(
        'test',
        'TEST_WORKER',
        { value: 10 },
        { forceFork: false },
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ processed: 20 });
    });

    it('should handle multiple workers', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const result1 = await workerPool.sendRequest('test', 'TEST_WORKER', {
        value: 5,
      });
      const result2 = await workerPool.sendRequest('compute', 'COMPUTE', {
        a: 3,
        b: 7,
      });

      expect(result1.result).toEqual({ processed: 10 });
      expect(result2.result).toEqual({ result: 10 });
    });

    it('should throw error for unknown worker type', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      await expect(
        workerPool.sendRequest('unknown', 'UNKNOWN_TYPE', {}),
      ).rejects.toThrow('Unknown worker type: unknown');
    });

    it('should get statistics', () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const stats = workerPool.getStats();

      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('workersByType');
      expect(stats).toHaveProperty('pendingRequests');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats.workersByType).toHaveProperty('test');
      expect(stats.workersByType).toHaveProperty('compute');
    });

    it('should track request count', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const initialStats = workerPool.getStats();
      const initialCount = initialStats.totalRequests;

      await workerPool.sendRequest('test', 'TEST_WORKER', { value: 5 });
      await workerPool.sendRequest('test', 'TEST_WORKER', { value: 10 });

      const finalStats = workerPool.getStats();

      expect(finalStats.totalRequests).toBeGreaterThan(initialCount);
    });

    it('should unregister worker type', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
        forceFork: true, // Force fork mode to test pool unregistration
      });

      expect(workerPool.workerPools).toHaveProperty('test');

      const unregistered = workerPool.unregisterWorker('test');

      expect(unregistered).toBe(true);
      expect(workerPool.workerPools).not.toHaveProperty('test');

      // After unregistering, requests should fail in fork mode
      await expect(
        workerPool.sendRequest('test', 'TEST_WORKER', { value: 5 }),
      ).rejects.toThrow('Unknown worker type: test');
    });

    it('should return false when unregistering non-existent worker', () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const unregistered = workerPool.unregisterWorker('nonexistent');

      expect(unregistered).toBe(false);
    });

    it('should cleanup all workers', async () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      await workerPool.sendRequest('test', 'TEST_WORKER', { value: 5 });

      await workerPool.cleanup();

      const stats = workerPool.getStats();

      expect(stats.totalWorkers).toBe(0);
      expect(stats.pendingRequests).toBe(0);
    });

    it('should use custom configuration', () => {
      workerPool = createWorkerPool(mockContext, {
        engineName: 'CustomEngine',
        maxWorkers: 8,
        workerTimeout: 30000,
      });

      expect(workerPool.maxWorkers).toBe(8);
      expect(workerPool.workerTimeout).toBe(30000);
    });

    it('should handle worker errors gracefully', async () => {
      // Add an error worker to the mock context
      const errorWorkerHandler = createWorkerHandler(async () => {
        throw new Error('Worker processing error');
      }, 'ERROR_WORKER');

      mockContext.keys = jest.fn(() => [
        './test.worker.js',
        './error.worker.js',
      ]);

      mockContext = jest.fn(key => {
        if (key === './test.worker.js') {
          return {
            default: createWorkerHandler(
              async data => ({ processed: data.value * 2 }),
              'TEST_WORKER',
            ),
          };
        }
        if (key === './error.worker.js') {
          return { default: errorWorkerHandler };
        }
        throw new Error(`Module not found: ${key}`);
      });

      mockContext.keys = jest.fn(() => [
        './test.worker.js',
        './error.worker.js',
      ]);

      mockContext.resolve = jest.fn(key => {
        const basePath = '/fake/path/to/workers';
        return `${basePath}/${key.replace('./', '')}`;
      });

      workerPool = createWorkerPool(mockContext, {
        engineName: 'Test',
      });

      const result = await workerPool.sendRequest('error', 'ERROR_WORKER', {});

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Worker processing error');

      // Clean up error worker handler
      unregisterWorkerHandler('ERROR_WORKER');
    });
  });
});
