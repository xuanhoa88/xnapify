/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import crypto from 'crypto';

import { createFactory as createHookFactory } from '../hook';

import { WebhookError, WebhookValidationError } from './errors';
import { WEBHOOK_EVENTS, SIGNATURE_ALGORITHMS } from './utils/constants';
import { verifySignature, parseSignatureHeader } from './utils/signature';

import { createFactory } from '.';

// Helper: generate a valid HMAC signature for test payloads
function sign(payload, secret, algorithm = 'sha256') {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

describe('Webhook Engine', () => {
  // Helper: create a webhook with an injected hook context (mirrors bootstrap)
  const createWebhook = () =>
    createFactory().withContext({ resolve: () => createHookFactory() });

  describe('Default Instance', () => {
    it('should be a webhook manager instance', () => {
      const webhook = createWebhook();
      expect(webhook).toBeDefined();
      expect(webhook).toHaveProperty('handler');
      expect(webhook).toHaveProperty('removeHandler');
      expect(webhook).toHaveProperty('hasHandler');
      expect(webhook).toHaveProperty('getProviders');
      expect(webhook).toHaveProperty('getProviderConfig');
      expect(webhook).toHaveProperty('dispatch');
      expect(webhook).toHaveProperty('on');
      expect(webhook).toHaveProperty('off');
      expect(webhook).toHaveProperty('cleanup');
      expect(webhook).toHaveProperty('parseSignatureHeader');
      expect(webhook).toHaveProperty('verifySignature');
      webhook.cleanup();
    });
  });

  describe('createFactory()', () => {
    it('should create independent instances', () => {
      const instance1 = createWebhook();
      const instance2 = createWebhook();

      instance1.handler('test', {
        secret: 'secret1',
        handler: async () => {},
      });

      expect(instance1.hasHandler('test')).toBe(true);
      expect(instance2.hasHandler('test')).toBe(false);

      instance1.cleanup();
    });
  });

  describe('Handler Registration', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createWebhook();
    });

    afterEach(() => {
      testWebhook.cleanup();
    });

    it('should register a provider handler', () => {
      testWebhook.handler('stripe', {
        secret: 'whsec_test',
        signatureHeader: 'stripe-signature',
        handler: async () => {},
      });

      expect(testWebhook.hasHandler('stripe')).toBe(true);
      expect(testWebhook.getProviders()).toContain('stripe');
    });

    it('should store provider config', () => {
      testWebhook.handler('github', {
        secret: 'gh_secret',
        signatureHeader: 'x-hub-signature-256',
        handler: async () => {},
      });

      const config = testWebhook.getProviderConfig('github');
      expect(config).toBeDefined();
      expect(config.secret).toBe('gh_secret');
      expect(config.signatureHeader).toBe('x-hub-signature-256');
    });

    it('should use default signature header when not specified', () => {
      testWebhook.handler('custom', {
        secret: 'my_secret',
        handler: async () => {},
      });

      const config = testWebhook.getProviderConfig('custom');
      expect(config.signatureHeader).toBe('x-webhook-signature');
    });

    it('should support method chaining', () => {
      const result = testWebhook
        .handler('a', { secret: 's1', handler: async () => {} })
        .handler('b', { secret: 's2', handler: async () => {} });

      expect(result).toBe(testWebhook);
      expect(testWebhook.getProviders()).toEqual(['a', 'b']);
    });

    it('should throw on missing provider', () => {
      expect(() =>
        testWebhook.handler('', { secret: 'x', handler: async () => {} }),
      ).toThrow(WebhookValidationError);
    });

    it('should throw on missing secret', () => {
      expect(() =>
        testWebhook.handler('test', { handler: async () => {} }),
      ).toThrow(WebhookValidationError);
    });

    it('should throw on missing handler function', () => {
      expect(() => testWebhook.handler('test', { secret: 'x' })).toThrow(
        WebhookValidationError,
      );
    });

    it('should throw on invalid config', () => {
      expect(() => testWebhook.handler('test', null)).toThrow(
        WebhookValidationError,
      );
    });
  });

  describe('Handler Removal', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createWebhook();
      testWebhook.handler('stripe', {
        secret: 'whsec_test',
        handler: async () => {},
      });
    });

    afterEach(() => {
      testWebhook.cleanup();
    });

    it('should remove a provider handler', () => {
      testWebhook.removeHandler('stripe');
      expect(testWebhook.hasHandler('stripe')).toBe(false);
      expect(testWebhook.getProviders()).not.toContain('stripe');
    });

    it('should not throw when removing non-existent provider', () => {
      expect(() => testWebhook.removeHandler('unknown')).not.toThrow();
    });

    it('should support chaining', () => {
      const result = testWebhook.removeHandler('stripe');
      expect(result).toBe(testWebhook);
    });
  });

  describe('Dispatch', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createWebhook();
    });

    afterEach(() => {
      testWebhook.cleanup();
    });

    it('should dispatch payload to registered handler', async () => {
      const received = [];

      testWebhook.handler('test', {
        secret: 'secret',
        handler: async (payload, context) => {
          received.push({ payload, context });
        },
      });

      const payload = { event: 'test.created' };
      const context = { headers: {}, query: {}, ip: '127.0.0.1' };

      await testWebhook.dispatch('test', payload, context);

      expect(received).toHaveLength(1);
      expect(received[0].payload).toEqual(payload);
      expect(received[0].context).toEqual(expect.objectContaining(context));
      expect(received[0].context).toHaveProperty('container');
    });

    it('should fire beforeHandle and afterHandle lifecycle hooks', async () => {
      const order = [];

      testWebhook.on('beforeHandle', async () => {
        order.push('before');
      });

      testWebhook.handler('test', {
        secret: 'secret',
        handler: async () => {
          order.push('handler');
        },
      });

      testWebhook.on('afterHandle', async () => {
        order.push('after');
      });

      await testWebhook.dispatch('test', {}, {});

      expect(order).toEqual(['before', 'handler', 'after']);
    });

    it('should pass provider info to lifecycle hooks', async () => {
      const hookData = [];

      testWebhook.on('beforeHandle', async data => {
        hookData.push(data);
      });

      testWebhook.handler('github', {
        secret: 'secret',
        handler: async () => {},
      });

      await testWebhook.dispatch(
        'github',
        { action: 'push' },
        { ip: '1.2.3.4' },
      );

      expect(hookData).toHaveLength(1);
      expect(hookData[0].provider).toBe('github');
      expect(hookData[0].payload).toEqual({ action: 'push' });
    });

    it('should handle handler errors gracefully', async () => {
      testWebhook.handler('fail', {
        secret: 'secret',
        handler: async () => {
          throw new Error('Handler crashed');
        },
      });

      // HookChannel catches errors in handler and doesn't throw
      // If it does throw, the controller catches it
      await expect(testWebhook.dispatch('fail', {}, {})).rejects.toThrow(
        'Handler crashed',
      );
    });
  });

  describe('Signature Utilities', () => {
    const secret = 'my-secret-key';

    describe('parseSignatureHeader', () => {
      it('should parse algorithm=signature format', () => {
        const result = parseSignatureHeader('sha256=deadbeef');
        expect(result.algorithm).toBe('sha256');
        expect(result.signature).toBe('deadbeef');
      });

      it('should parse sha512 prefix', () => {
        const result = parseSignatureHeader('sha512=cafebabe');
        expect(result.algorithm).toBe('sha512');
        expect(result.signature).toBe('cafebabe');
      });

      it('should default to sha256 when no prefix', () => {
        const result = parseSignatureHeader('abcdef1234');
        expect(result.algorithm).toBe('sha256');
        expect(result.signature).toBe('abcdef1234');
      });

      it('should handle empty/null input', () => {
        const result = parseSignatureHeader(null);
        expect(result.algorithm).toBe('sha256');
        expect(result.signature).toBe('');
      });
    });

    describe('verifySignature', () => {
      it('should verify valid signature', () => {
        const payload = { event: 'test' };
        const sig = sign(payload, secret, 'sha256');

        expect(verifySignature(payload, sig, secret, 'sha256')).toBe(true);
      });

      it('should reject invalid signature', () => {
        const payload = { event: 'test' };
        const sig = sign(payload, secret, 'sha256');
        const fakeSig = sig.slice(0, -4) + '0000';

        expect(verifySignature(payload, fakeSig, secret, 'sha256')).toBe(false);
      });

      it('should verify sha512 signature', () => {
        const payload = { data: 'hello' };
        const sig = sign(payload, secret, 'sha512');

        expect(verifySignature(payload, sig, secret, 'sha512')).toBe(true);
      });

      it('should verify string payload', () => {
        const payload = 'raw-body-string';
        const sig = sign(payload, secret, 'sha256');

        expect(verifySignature(payload, sig, secret, 'sha256')).toBe(true);
      });

      it('should return false for empty signature', () => {
        expect(verifySignature({}, '', secret)).toBe(false);
      });

      it('should return false for empty secret', () => {
        expect(verifySignature({}, 'abc', '')).toBe(false);
      });

      it('should return false when signature lengths differ', () => {
        expect(verifySignature({}, 'short', secret)).toBe(false);
      });

      it('should produce consistent results for same input', () => {
        const payload = { id: 123 };
        const sig = sign(payload, secret);

        expect(verifySignature(payload, sig, secret)).toBe(true);
        expect(verifySignature(payload, sig, secret)).toBe(true);
      });
    });
  });

  describe('Constants', () => {
    it('should have webhook event constants', () => {
      expect(WEBHOOK_EVENTS.HANDLER).toBe('handler');
      expect(WEBHOOK_EVENTS.BEFORE_HANDLE).toBe('beforeHandle');
      expect(WEBHOOK_EVENTS.AFTER_HANDLE).toBe('afterHandle');
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
    });

    it('should create WebhookValidationError', () => {
      const error = new WebhookValidationError('Invalid field', 'url');
      expect(error).toBeInstanceOf(WebhookError);
      expect(error.name).toBe('WebhookValidationError');
      expect(error.field).toBe('url');
      expect(error.status).toBe(400);
    });
  });

  describe('Cleanup', () => {
    it('should clear all providers and handlers', () => {
      const instance = createWebhook();

      instance.handler('a', { secret: 's1', handler: async () => {} });
      instance.handler('b', { secret: 's2', handler: async () => {} });

      instance.cleanup();

      expect(instance.getProviders()).toEqual([]);
      expect(instance.hasHandler('a')).toBe(false);
      expect(instance.hasHandler('b')).toBe(false);
    });

    it('should allow multiple cleanup calls', () => {
      const instance = createWebhook();
      instance.cleanup();
      instance.cleanup();
      expect(instance.getProviders()).toEqual([]);
    });
  });

  describe('Lifecycle Hooks', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createWebhook();
    });

    afterEach(() => {
      testWebhook.cleanup();
    });

    it('should register and remove lifecycle hooks', async () => {
      const calls = [];
      const hook = async () => calls.push('called');

      testWebhook.on('beforeHandle', hook);
      testWebhook.handler('test', { secret: 's', handler: async () => {} });

      await testWebhook.dispatch('test', {}, {});
      expect(calls).toHaveLength(1);

      testWebhook.off('beforeHandle', hook);
      await testWebhook.dispatch('test', {}, {});
      expect(calls).toHaveLength(1); // Not called again
    });

    it('should support chaining on on/off', () => {
      const result = testWebhook
        .on('beforeHandle', async () => {})
        .on('afterHandle', async () => {});

      expect(result).toBe(testWebhook);
    });
  });
  describe('Instance Proxy Methods', () => {
    let testWebhook;

    beforeEach(() => {
      testWebhook = createWebhook();
    });

    afterEach(() => {
      testWebhook.cleanup();
    });

    it('should parse signature header via instance method', () => {
      const result = testWebhook.parseSignatureHeader('sha256=deadbeef');
      expect(result.algorithm).toBe('sha256');
      expect(result.signature).toBe('deadbeef');
    });

    it('should handle null header via instance method', () => {
      const result = testWebhook.parseSignatureHeader(null);
      expect(result.algorithm).toBe('sha256');
      expect(result.signature).toBe('');
    });

    it('should verify valid signature via instance method', () => {
      const payload = { event: 'test' };
      const secret = 'my-secret';
      const sig = sign(payload, secret, 'sha256');

      expect(testWebhook.verifySignature(payload, sig, secret, 'sha256')).toBe(
        true,
      );
    });

    it('should reject invalid signature via instance method', () => {
      const payload = { event: 'test' };
      const secret = 'my-secret';

      expect(
        testWebhook.verifySignature(payload, 'invalid', secret, 'sha256'),
      ).toBe(false);
    });

    it('should produce same results as standalone utils', () => {
      const header = 'sha512=cafebabe';
      const instanceResult = testWebhook.parseSignatureHeader(header);
      const standaloneResult = parseSignatureHeader(header);

      expect(instanceResult).toEqual(standaloneResult);
    });
  });
});
