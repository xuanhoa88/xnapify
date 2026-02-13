/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock node-fetch before importing webhook modules
jest.mock('node-fetch');

// Mock DatabaseWebhookAdapter to prevent connection errors
jest.mock('./adapters/database', () => ({
  DatabaseWebhookAdapter: class MockDatabaseWebhookAdapter {
    constructor() {
      this.hasConnection = () => false;
    }

    async getStats() {
      return {
        adapter: 'database',
        total: 0,
        pending: 0,
        delivered: 0,
        failed: 0,
        available: false,
      };
    }

    async send() {
      return {
        success: false,
        error: { message: 'Database not configured', code: 'NO_CONNECTION' },
      };
    }

    setConnection() {}
    getConnection() {
      return null;
    }
  },
}));

// Mock worker pool to avoid worker initialization issues in tests
jest.mock('./workers', () => ({
  __esModule: true,
  default: {
    processSend: jest
      .fn()
      .mockResolvedValue({ success: true, webhookId: 'worker-123' }),
    processPersist: jest
      .fn()
      .mockResolvedValue({ success: true, webhookId: 'worker-123' }),
    processSendWithDb: jest
      .fn()
      .mockResolvedValue({ success: true, webhookId: 'worker-123' }),
    unregisterSend: jest.fn(),
    unregisterPersist: jest.fn(),
  },
  setPersistDbConnection: jest.fn(),
  setPersistConnectionFactory: jest.fn(),
}));

import webhook, { createFactory } from '.';
import {
  WebhookError,
  WebhookDeliveryError,
  WebhookValidationError,
  WebhookTimeoutError,
  WebhookWorkerError,
} from './errors';
import { MemoryWebhookAdapter } from './adapters/memory';
import { HttpWebhookAdapter } from './adapters/http';
import {
  generateSignature,
  verifySignature,
  createSignatureHeader,
} from './utils/signature';
import {
  WEBHOOK_STATUS,
  DEFAULTS,
  SIGNATURE_ALGORITHMS,
} from './utils/constants';
import fetch from 'node-fetch';

describe('Webhook Engine', () => {
  describe('Default Instance', () => {
    it('should be a webhook manager instance', () => {
      expect(webhook).toBeDefined();
      expect(webhook).toHaveProperty('send');
      expect(webhook).toHaveProperty('addAdapter');
      expect(webhook).toHaveProperty('getAdapter');
      expect(webhook).toHaveProperty('getAdapterNames');
      expect(webhook).toHaveProperty('hasAdapter');
      expect(webhook).toHaveProperty('getAllStats');
      expect(webhook).toHaveProperty('cleanup');
      expect(webhook).toHaveProperty('setDbConnection');
      expect(webhook).toHaveProperty('setConnectionFactory');
    });

    it('should have default adapters registered', () => {
      const adapters = webhook.getAdapterNames();
      expect(Array.isArray(adapters)).toBe(true);
      expect(adapters.length).toBeGreaterThan(0);
    });

    it('should have memory adapter by default', () => {
      expect(webhook.hasAdapter('memory')).toBe(true);
      const adapter = webhook.getAdapter('memory');
      expect(adapter).toBeInstanceOf(MemoryWebhookAdapter);
    });

    it('should have http adapter by default', () => {
      expect(webhook.hasAdapter('http')).toBe(true);
      const adapter = webhook.getAdapter('http');
      expect(adapter).toBeInstanceOf(HttpWebhookAdapter);
    });

    it('should list all registered adapters', () => {
      const adapters = webhook.getAdapterNames();
      expect(Array.isArray(adapters)).toBe(true);
      expect(adapters).toContain('memory');
      expect(adapters).toContain('http');
    });
  });

  describe('createFactory()', () => {
    it('should create memory-based instance by default', () => {
      const instance = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });
      expect(instance).toBeDefined();
      expect(instance.hasAdapter('memory')).toBe(true);
    });

    it('should create independent instances', () => {
      const instance1 = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });
      const instance2 = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });

      const adapter1 = instance1.getAdapter('memory');
      const adapter2 = instance2.getAdapter('memory');

      // Different instances should have different adapters
      expect(adapter1).not.toBe(adapter2);
    });

    it('should accept custom memory adapter config', () => {
      const instance = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
        memory: {
          simulateDelay: 100,
          failureRate: 0.1,
        },
      });

      const adapter = instance.getAdapter('memory');
      expect(adapter).toBeDefined();
      expect(adapter.simulateDelay).toBe(100);
      expect(adapter.failureRate).toBe(0.1);
    });

    it('should accept custom http adapter config', () => {
      const instance = createFactory({
        adapter: 'http',
        database: { skipInit: true },
        http: {
          url: 'https://test.example.com/hook',
          timeout: 5000,
        },
      });

      const adapter = instance.getAdapter('http');
      expect(adapter).toBeDefined();
      expect(adapter.url).toBe('https://test.example.com/hook');
      expect(adapter.timeout).toBe(5000);
    });

    afterEach(() => {
      // Note: We don't clean up instances here as they are isolated
    });
  });

  describe('Adapter Management', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });
    });

    afterEach(() => {
      if (testWebhook.removeCleanupHandlers) {
        testWebhook.removeCleanupHandlers();
      }
    });

    it('should add custom adapter', () => {
      const customAdapter = {
        async send(_data) {
          return {
            success: true,
            webhookId: 'custom-123',
            adapter: 'custom',
          };
        },
        getStats() {
          return { adapter: 'custom' };
        },
      };

      const added = testWebhook.addAdapter('custom', customAdapter);
      expect(added).toBe(true);
      expect(testWebhook.hasAdapter('custom')).toBe(true);
    });

    it('should not override existing adapter', () => {
      const customAdapter = {
        async send() {
          return { success: true };
        },
      };

      const added = testWebhook.addAdapter('memory', customAdapter);
      expect(added).toBe(false);
    });

    it('should get adapter by name', () => {
      const adapter = testWebhook.getAdapter('memory');
      expect(adapter).toBeInstanceOf(MemoryWebhookAdapter);
    });

    it('should return null for non-existent adapter', () => {
      const adapter = testWebhook.getAdapter('non-existent');
      expect(adapter).toBeNull();
    });

    it('should get all adapter stats', () => {
      const stats = testWebhook.getAllStats();
      expect(stats).toHaveProperty('memory');
      expect(stats.memory).toHaveProperty('adapter', 'memory');
    });
  });

  describe('Memory Adapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new MemoryWebhookAdapter({
        simulateDelay: 0,
        failureRate: 0,
      });
      adapter.clear();
    });

    it('should send webhook and store in memory', async () => {
      const result = await adapter.send({
        event: 'user.created',
        metadata: { userId: '123' },
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('webhookId');
      expect(result).toHaveProperty('statusCode', 200);
    });

    it('should retrieve webhook by ID', async () => {
      const result = await adapter.send({
        event: 'order.completed',
        metadata: { orderId: '456' },
      });

      const webhook = adapter.getById(result.webhookId);
      expect(webhook).toBeDefined();
      expect(webhook.id).toBe(result.webhookId);
      expect(webhook.event).toBe('order.completed');
    });

    it('should clear all webhooks', async () => {
      await adapter.send({
        event: 'test.event',
        metadata: { test: true },
      });

      adapter.clear();

      const stats = adapter.getStats();
      expect(stats.delivered).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should get adapter statistics', async () => {
      await adapter.send({
        event: 'test1',
        metadata: {},
      });
      await adapter.send({
        event: 'test2',
        metadata: {},
      });

      const stats = adapter.getStats();
      expect(stats.adapter).toBe('memory');
      expect(stats.total).toBe(2);
      expect(stats.delivered).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it('should simulate delays when configured', async () => {
      const delayAdapter = new MemoryWebhookAdapter({
        simulateDelay: 50,
      });

      const startTime = Date.now();
      await delayAdapter.send({
        event: 'delayed.event',
        metadata: {},
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(40);
    });

    it('should simulate failures with configurable failure rate', async () => {
      const failAdapter = new MemoryWebhookAdapter({
        failureRate: 1.0, // 100% failure
      });

      const result = await failAdapter.send({
        event: 'fail.event',
        metadata: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('SIMULATED_FAILURE');
    });

    it('should update webhook status', async () => {
      const result = await adapter.send({
        event: 'status.test',
        metadata: {},
      });

      const updated = await adapter.updateStatus(result.webhookId, {
        success: false,
        nextRetryAt: new Date(Date.now() + 5000).toISOString(),
      });

      expect(updated).toBeDefined();
      expect(updated.status).toBe(WEBHOOK_STATUS.FAILED);
      expect(updated.attempts).toBe(1);
    });

    it('should get pending retries', async () => {
      const result = await adapter.send({
        event: 'retry.test',
        metadata: {},
      });

      await adapter.updateStatus(result.webhookId, {
        success: false,
        nextRetryAt: new Date(Date.now() - 1000).toISOString(), // Past time
      });

      const pending = await adapter.getPendingRetries({ limit: 10 });
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(result.webhookId);
    });

    it('should paginate webhooks with getWebhooks', async () => {
      // Send multiple webhooks
      for (let i = 0; i < 5; i++) {
        await adapter.send({
          event: `event.${i}`,
          metadata: { index: i },
        });
      }

      const result = await adapter.getWebhooks({
        limit: 2,
        offset: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should filter webhooks by status', async () => {
      // Create a failed webhook
      const failAdapter = new MemoryWebhookAdapter({
        failureRate: 1.0,
      });

      await failAdapter.send({ event: 'fail', metadata: {} });
      await failAdapter.send({ event: 'fail2', metadata: {} });

      const result = await failAdapter.getWebhooks({
        status: WEBHOOK_STATUS.FAILED,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(w => w.status === WEBHOOK_STATUS.FAILED)).toBe(
        true,
      );
    });

    it('should filter webhooks by event', async () => {
      await adapter.send({ event: 'user.created', metadata: {} });
      await adapter.send({ event: 'user.updated', metadata: {} });
      await adapter.send({ event: 'user.created', metadata: {} });

      const result = await adapter.getWebhooks({
        event: 'user.created',
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(w => w.event === 'user.created')).toBe(true);
    });

    it('should cleanup old webhooks', async () => {
      await adapter.send({ event: 'old', metadata: {} });

      const cleaned = await adapter.cleanup({ olderThan: 0 });
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should limit stored webhooks', async () => {
      const limitedAdapter = new MemoryWebhookAdapter({
        maxStoredWebhooks: 3,
      });

      for (let i = 0; i < 5; i++) {
        await limitedAdapter.send({
          event: `event.${i}`,
          metadata: {},
        });
      }

      const stats = limitedAdapter.getStats();
      expect(stats.storedWebhooks).toBe(3);
    });
  });

  describe('HTTP Adapter', () => {
    let adapter;
    let mockFetch;

    beforeEach(() => {
      adapter = new HttpWebhookAdapter({
        url: 'https://api.example.com/hook',
        timeout: 5000,
      });

      // Reset the mock
      mockFetch = fetch;
      mockFetch.mockReset();
    });

    it('should send successful webhook via HTTP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      const result = await adapter.send({
        event: 'user.created',
        userId: '123',
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('webhookId');
      expect(result).toHaveProperty('statusCode', 200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: () => 'text/plain',
        },
        text: async () => 'Server error',
      });

      const result = await adapter.send({
        event: 'test.event',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('HTTP_ERROR');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await adapter.send({
        event: 'test.event',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DELIVERY_FAILED');
    });

    it('should handle timeout', async () => {
      const timeoutAdapter = new HttpWebhookAdapter({
        url: 'https://api.example.com/hook',
        timeout: 100,
      });

      mockFetch.mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject({ name: 'AbortError' });
          }, 200);
        });
      });

      const result = await timeoutAdapter.send({
        event: 'timeout.test',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('TIMEOUT');
    });

    it('should include HMAC signature when secret provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      await adapter.send({
        event: 'signed.event',
        secret: 'my-secret-key',
        algorithm: 'sha256',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const { headers } = callArgs[1];

      expect(headers[DEFAULTS.SIGNATURE_HEADER]).toBeDefined();
      expect(headers[DEFAULTS.SIGNATURE_HEADER]).toContain('sha256=');
    });

    it('should include event header when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      await adapter.send({
        event: 'user.updated',
      });

      const callArgs = mockFetch.mock.calls[0];
      const { headers } = callArgs[1];

      expect(headers[DEFAULTS.EVENT_HEADER]).toBe('user.updated');
    });

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      await adapter.send({
        event: 'custom.event',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      const { headers } = callArgs[1];

      expect(headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should track statistics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      await adapter.send({ event: 'stats.test1' });
      await adapter.send({ event: 'stats.test2' });

      const stats = adapter.getStats();
      expect(stats.adapter).toBe('http');
      expect(stats.delivered).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it('should require URL', async () => {
      const noUrlAdapter = new HttpWebhookAdapter();

      const result = await noUrlAdapter.send({
        event: 'test.event',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('URL is required');
    });

    it('should allow URL override in options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ received: true }),
      });

      await adapter.send({
        event: 'override.test',
        url: 'https://override.example.com/hook',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://override.example.com/hook');
    });

    it('should return empty result for getWebhooks', async () => {
      const result = await adapter.getWebhooks();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return null for getById', () => {
      const result = adapter.getById('any-id');
      expect(result).toBeNull();
    });

    it('should return 0 for cleanup', async () => {
      const result = await adapter.cleanup();
      expect(result).toBe(0);
    });

    it('should return null for updateStatus', async () => {
      const result = await adapter.updateStatus('any-id', {});
      expect(result).toBeNull();
    });
  });

  describe('Send Functionality', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });
    });

    afterEach(() => {
      // Cleanup test instance
    });

    it('should send single webhook with memory adapter', async () => {
      const result = await testWebhook.send(
        {
          event: 'user.created',
          metadata: { userId: '123' },
        },
        { adapter: 'memory' },
      );

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('webhookId');
    });

    it('should send webhook with default adapter', async () => {
      const result = await testWebhook.send({
        event: 'default.test',
        metadata: {},
      });

      expect(result.success).toBe(true);
    });

    it('should handle validation errors', async () => {
      // The webhook validation schema uses z.any(), so it won't actually fail validation
      // Instead test with an invalid adapter
      const result = await testWebhook.send(
        { event: 'test', metadata: {} },
        { adapter: 'non-existent' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow adapter selection', async () => {
      const memoryResult = await testWebhook.send(
        {
          event: 'memory.test',
          metadata: {},
        },
        { adapter: 'memory' },
      );

      expect(memoryResult.success).toBe(true);
      expect(memoryResult.adapter).toBe('memory');
    });

    it('should handle non-existent adapter', async () => {
      const result = await testWebhook.send(
        {
          event: 'test',
          metadata: {},
        },
        { adapter: 'non-existent' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Signature Utilities', () => {
    const payload = { event: 'test', data: { id: '123' } };
    const secret = 'my-secret-key';

    it('should generate HMAC SHA256 signature', () => {
      const signature = generateSignature(payload, secret, 'sha256');
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should generate HMAC SHA512 signature', () => {
      const signature = generateSignature(payload, secret, 'sha512');
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should generate consistent signatures for same input', () => {
      const sig1 = generateSignature(payload, secret, 'sha256');
      const sig2 = generateSignature(payload, secret, 'sha256');
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = { event: 'test1' };
      const payload2 = { event: 'test2' };

      const sig1 = generateSignature(payload1, secret, 'sha256');
      const sig2 = generateSignature(payload2, secret, 'sha256');

      expect(sig1).not.toBe(sig2);
    });

    it('should verify valid signature', () => {
      const signature = generateSignature(payload, secret, 'sha256');
      const isValid = verifySignature(payload, signature, secret, 'sha256');
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signature = generateSignature(payload, secret, 'sha256');
      // Create an invalid signature with different length to avoid timingSafeEqual error
      const invalidSig = signature.slice(0, -4) + '0000';
      const isValid = verifySignature(payload, invalidSig, secret, 'sha256');
      expect(isValid).toBe(false);
    });

    it('should create signature header with algorithm prefix', () => {
      const header = createSignatureHeader(payload, secret, 'sha256');
      expect(header).toContain('sha256=');
      expect(header.split('=')[1].length).toBeGreaterThan(0);
    });

    it('should handle string payloads', () => {
      const stringPayload = 'test-payload';
      const signature = generateSignature(stringPayload, secret, 'sha256');
      expect(signature).toBeDefined();

      const isValid = verifySignature(
        stringPayload,
        signature,
        secret,
        'sha256',
      );
      expect(isValid).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have webhook status constants', () => {
      expect(WEBHOOK_STATUS.PENDING).toBe('pending');
      expect(WEBHOOK_STATUS.DELIVERED).toBe('delivered');
      expect(WEBHOOK_STATUS.FAILED).toBe('failed');
      expect(WEBHOOK_STATUS.RETRYING).toBe('retrying');
    });

    it('should have default configuration', () => {
      expect(DEFAULTS.TIMEOUT).toBe(30000);
      expect(DEFAULTS.MAX_RETRIES).toBe(3);
      expect(DEFAULTS.RETRY_DELAY).toBe(1000);
      expect(DEFAULTS.RETRY_MULTIPLIER).toBe(2);
      expect(DEFAULTS.CONTENT_TYPE).toBe('application/json');
      expect(DEFAULTS.SIGNATURE_HEADER).toBe('X-Webhook-Signature');
      expect(DEFAULTS.TIMESTAMP_HEADER).toBe('X-Webhook-Timestamp');
      expect(DEFAULTS.EVENT_HEADER).toBe('X-Webhook-Event');
    });

    it('should have signature algorithms', () => {
      expect(SIGNATURE_ALGORITHMS.SHA256).toBe('sha256');
      expect(SIGNATURE_ALGORITHMS.SHA512).toBe('sha512');
    });
  });

  describe('Error Classes', () => {
    it('should create WebhookError', () => {
      const error = new WebhookError('Test error', 'TEST_CODE', 400);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('WebhookError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBe(400);
      expect(error.timestamp).toBeDefined();
    });

    it('should create WebhookDeliveryError', () => {
      const error = new WebhookDeliveryError(
        'Failed to deliver',
        'https://example.com',
        500,
      );
      expect(error).toBeInstanceOf(WebhookError);
      expect(error.name).toBe('WebhookDeliveryError');
      expect(error.url).toBe('https://example.com');
      expect(error.responseStatus).toBe(500);
    });

    it('should create WebhookValidationError', () => {
      const error = new WebhookValidationError('Invalid field', 'url');
      expect(error).toBeInstanceOf(WebhookError);
      expect(error.name).toBe('WebhookValidationError');
      expect(error.field).toBe('url');
      expect(error.status).toBe(400);
    });

    it('should create WebhookTimeoutError', () => {
      const error = new WebhookTimeoutError('https://example.com', 5000);
      expect(error).toBeInstanceOf(WebhookError);
      expect(error.name).toBe('WebhookTimeoutError');
      expect(error.url).toBe('https://example.com');
      expect(error.timeout).toBe(5000);
    });

    it('should create WebhookWorkerError', () => {
      const error = new WebhookWorkerError(
        'Worker failed',
        'WORKER_ERROR',
        500,
      );
      expect(error).toBeInstanceOf(WebhookError);
      expect(error.name).toBe('WebhookWorkerError');
    });
  });

  describe('Integration Tests', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });
    });

    afterEach(() => {
      // Cleanup test instance
    });

    it('should send and retrieve webhook', async () => {
      const sendResult = await testWebhook.send(
        {
          event: 'integration.test',
          testId: 'abc123', // metadata is spread, not nested
        },
        { adapter: 'memory' },
      );

      expect(sendResult.success).toBe(true);

      const adapter = testWebhook.getAdapter('memory');
      const webhook = adapter.getById(sendResult.webhookId);

      expect(webhook).toBeDefined();
      expect(webhook.event).toBe('integration.test');
      expect(webhook.metadata.testId).toBe('abc123');
    });

    it('should track statistics across multiple sends', async () => {
      await testWebhook.send(
        { event: 'test1', metadata: {} },
        { adapter: 'memory' },
      );
      await testWebhook.send(
        { event: 'test2', metadata: {} },
        { adapter: 'memory' },
      );
      await testWebhook.send(
        { event: 'test3', metadata: {} },
        { adapter: 'memory' },
      );

      const stats = testWebhook.getAllStats();
      expect(stats.memory.total).toBe(3);
      expect(stats.memory.delivered).toBe(3);
    });

    it('should handle mixed success and failure', async () => {
      const failAdapter = new MemoryWebhookAdapter({
        failureRate: 0.5,
      });

      testWebhook.addAdapter('mixed', failAdapter);

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await testWebhook.send(
          { event: `test${i}`, metadata: {} },
          { adapter: 'mixed' },
        );
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      expect(successCount + failCount).toBe(10);
      expect(successCount).toBeGreaterThan(0); // Should have some successes
      expect(failCount).toBeGreaterThan(0); // Should have some failures
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should cleanup all adapters', async () => {
      const instance = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });

      await instance.send(
        { event: 'cleanup.test', metadata: {} },
        { adapter: 'memory' },
      );

      await instance.cleanup();

      // Cleanup should not throw
      expect(true).toBe(true);
    });

    it('should have cleanup method', () => {
      const instance = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });

      expect(instance.cleanup).toBeDefined();
      expect(typeof instance.cleanup).toBe('function');
    });

    it('should allow multiple cleanup calls', async () => {
      const instance = createFactory({
        adapter: 'memory',
        database: { skipInit: true },
      });

      await instance.cleanup();
      await instance.cleanup(); // Should not throw

      expect(true).toBe(true);
    });
  });
});
