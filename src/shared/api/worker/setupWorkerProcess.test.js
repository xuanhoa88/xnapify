/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  setupWorkerProcess,
  unregisterWorkerProcess,
} from './setupWorkerProcess';

describe('Worker Engine - setupWorkerProcess Extended', () => {
  let originalSend;
  let originalConnected;
  let mockSentMessages = [];
  let mockConnected = true;

  beforeAll(() => {
    originalSend = process.send;
    originalConnected = Object.getOwnPropertyDescriptor(process, 'connected');
  });

  afterAll(() => {
    if (originalSend) process.send = originalSend;
    if (originalConnected) {
      Object.defineProperty(process, 'connected', originalConnected);
    } else {
      delete process.connected;
    }
  });

  beforeEach(() => {
    mockSentMessages = [];
    mockConnected = true;

    // Mock process.send
    process.send = jest.fn(message => {
      if (!mockConnected) {
        throw new Error('Channel closed');
      }
      mockSentMessages.push(message);
    });

    // Mock process.connected
    Object.defineProperty(process, 'connected', {
      get: () => mockConnected,
      configurable: true,
    });
  });

  afterEach(() => {
    // Cleanup any registered workers
    const workers = [
      'Test1',
      'Test2',
      'Test3',
      'Test4',
      'Test5',
      'Test6',
      'Test7',
      'Test8',
      'Test9',
      'Test10',
    ];
    workers.forEach(name => unregisterWorkerProcess(name));
  });

  const getLastMessage = () => mockSentMessages[mockSentMessages.length - 1];

  const simulateMessage = async message => {
    const listeners = process.listeners('message');
    // Find the handler that was just registered (last one usually, or iterate)
    // setupWorkerProcess registers a handler. We assume it's the last one or we can capture it.
    // However, since we are in a test env with other tests potentially running, strict index might be flaky.
    // But setupWorkerProcess.js adds `process.on('message', handleMessage)`.
    // In this isolated test file, we can try invoking the last added listener.
    const handler = listeners[listeners.length - 1];
    if (handler) {
      await handler(message);
    }
  };

  test('Test 1: Successful Processing', async () => {
    const processFunc = async data => ({ result: `Processed: ${data.value}` });

    setupWorkerProcess(processFunc, 'TEST', 'Test1', {
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-1',
      type: 'TEST',
      data: { value: 'hello' },
    });

    const response = getLastMessage();
    expect(response.success).toBe(true);
    expect(response.result.result).toBe('Processed: hello');
    expect(response.meta.duration).toBeGreaterThanOrEqual(0);
  });

  test('Test 2: Timeout with Retry', async () => {
    let attempts = 0;
    const processFunc = async () => {
      attempts++;
      if (attempts < 3) {
        // Simulate timeout by blocking/waiting longer than timeout
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return { result: 'success', attempts };
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test2', {
      timeoutMs: 50,
      maxRetries: 3,
      retryDelayMs: 10,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-2',
      type: 'TEST',
      data: { value: 'test' },
    });

    const response = getLastMessage();
    expect(response.success).toBe(true);
    expect(attempts).toBe(3);
    expect(response.meta.retries).toBeGreaterThan(0);
  });

  test('Test 3: Retryable Error', async () => {
    let attempts = 0;
    const processFunc = async () => {
      attempts++;
      if (attempts < 2) {
        const error = new Error('Service temporarily unavailable');
        error.code = 'SERVICE_UNAVAILABLE';
        error.retryable = true;
        throw error;
      }
      return { result: 'success after retry' };
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test3', {
      maxRetries: 3,
      retryDelayMs: 10,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-3',
      type: 'TEST',
      data: {},
    });

    const response = getLastMessage();
    expect(response.success).toBe(true);
    expect(attempts).toBe(2);
  });

  test('Test 4: Non-Retryable Error', async () => {
    let attempts = 0;
    const processFunc = async () => {
      attempts++;
      const error = new Error('Invalid input');
      error.code = 'INVALID_INPUT';
      error.retryable = false;
      throw error;
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test4', {
      maxRetries: 3,
      retryDelayMs: 10,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-4',
      type: 'TEST',
      data: {},
    });

    const response = getLastMessage();
    expect(response.success).toBe(false);
    expect(attempts).toBe(1);
    expect(response.error.code).toBe('INVALID_INPUT');
  });

  test('Test 5: Max Retries Exceeded', async () => {
    let attempts = 0;
    const processFunc = async () => {
      attempts++;
      const error = new Error('Always fails');
      error.retryable = true;
      throw error;
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test5', {
      maxRetries: 2,
      retryDelayMs: 10,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-5',
      type: 'TEST',
      data: {},
    });

    const response = getLastMessage();
    expect(response.success).toBe(false);
    expect(attempts).toBe(3); // Initial + 2 retries
    expect(response.error.totalAttempts).toBe(3);
  });

  test('Test 6: Invalid Message Handling', async () => {
    const processFunc = async () => ({ result: 'should not reach here' });

    setupWorkerProcess(processFunc, 'TEST', 'Test6', { enableLogging: false });

    // Missing id and data
    await simulateMessage({ type: 'TEST' });

    const response = getLastMessage();
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('INVALID_MESSAGE');
  });

  test('Test 7: Wrong Message Type', async () => {
    const processFunc = async () => ({ result: 'should not reach here' });

    setupWorkerProcess(processFunc, 'EXPECTED_TYPE', 'Test7', {
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-7',
      type: 'WRONG_TYPE',
      data: {},
    });

    const response = getLastMessage();
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('UNEXPECTED_TYPE');
  });

  test('Test 8: Exponential Backoff Timing', async () => {
    const retryTimings = [];
    const processFunc = async () => {
      retryTimings.push(Date.now());
      const error = new Error('Retry me');
      error.retryable = true;
      throw error;
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test8', {
      maxRetries: 3,
      retryDelayMs: 50,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-8',
      type: 'TEST',
      data: {},
    });

    expect(retryTimings.length).toBeGreaterThanOrEqual(3);
    const delay1 = retryTimings[1] - retryTimings[0];
    const delay2 = retryTimings[2] - retryTimings[1];

    // Check if delay2 is significantly larger than delay1 (exponential)
    // Allow for some execution time variance
    expect(delay2).toBeGreaterThan(delay1);
  });

  test('Test 9: Custom Timeout Override', async () => {
    const processFunc = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { result: 'should timeout' };
    };

    setupWorkerProcess(processFunc, 'TEST', 'Test9', {
      timeoutMs: 100,
      maxRetries: 0,
      enableLogging: false,
    });

    await simulateMessage({
      id: 'test-9',
      type: 'TEST',
      data: {
        timeout: 20, // Override to 20ms
      },
    });

    const response = getLastMessage();
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('TIMEOUT');
  });

  test('Test 10: Safe Send When Disconnected', async () => {
    mockConnected = false;

    const processFunc = async () => ({ result: 'test' });

    setupWorkerProcess(processFunc, 'TEST', 'Test10', { enableLogging: false });

    // Should not crash, just log warning/error
    await expect(
      simulateMessage({
        id: 'test-10',
        type: 'TEST',
        data: {},
      }),
    ).resolves.not.toThrow();

    mockConnected = true;
  });
});
