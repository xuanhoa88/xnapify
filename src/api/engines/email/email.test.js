/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import email, { createFactory } from '.';
import { validateEmails, EMAIL_LIMITS } from './utils/validation';
import { MemoryEmailProvider } from './providers/memory';

describe('Email Engine', () => {
  describe('Default Instance', () => {
    it('should be an email manager instance', () => {
      expect(email).toBeDefined();
      expect(email).toHaveProperty('send');
      expect(email).toHaveProperty('addProvider');
      expect(email).toHaveProperty('getProvider');
      expect(email).toHaveProperty('getProviderNames');
      expect(email).toHaveProperty('hasProvider');
      expect(email).toHaveProperty('getAllStats');
      expect(email).toHaveProperty('cleanup');
    });

    it('should have memory provider by default', () => {
      expect(email.hasProvider('memory')).toBe(true);
      const provider = email.getProvider('memory');
      expect(provider).toBeInstanceOf(MemoryEmailProvider);
    });

    it('should list all registered providers', () => {
      const providers = email.getProviderNames();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('memory');
    });
  });

  describe('createFactory()', () => {
    it('should create memory-based instance by default', () => {
      const instance = createFactory({ provider: 'memory' });
      expect(instance).toBeDefined();
      expect(instance.hasProvider('memory')).toBe(true);
    });

    it('should create independent instances', () => {
      const instance1 = createFactory({ provider: 'memory' });
      const instance2 = createFactory({ provider: 'memory' });

      const provider1 = instance1.getProvider('memory');
      const provider2 = instance2.getProvider('memory');

      // Different instances should have different providers
      expect(provider1).not.toBe(provider2);
    });

    it('should accept custom memory provider config', () => {
      const instance = createFactory({
        provider: 'memory',
        memory: {
          defaultFrom: 'custom@test.com',
          defaultFromName: 'Custom Test',
        },
      });

      const provider = instance.getProvider('memory');
      expect(provider.defaultFrom).toBe('custom@test.com');
      expect(provider.defaultFromName).toBe('Custom Test');
    });
  });

  describe('Provider Management', () => {
    let testEmail;

    beforeEach(() => {
      testEmail = createFactory({ provider: 'memory' });
    });

    afterEach(() => {
      if (testEmail.removeCleanupHandlers) {
        testEmail.removeCleanupHandlers();
      }
    });

    it('should add custom provider', () => {
      const customProvider = {
        async send(emailData) {
          return {
            success: true,
            messageId: 'custom-123',
            provider: 'custom',
          };
        },
      };

      const added = testEmail.addProvider('custom', customProvider);
      expect(added).toBe(true);
      expect(testEmail.hasProvider('custom')).toBe(true);
    });

    it('should not override existing provider', () => {
      const customProvider = {
        async send() {
          return { messageId: 'test' };
        },
      };

      const added = testEmail.addProvider('memory', customProvider);
      expect(added).toBe(false);
    });

    it('should get provider by name', () => {
      const provider = testEmail.getProvider('memory');
      expect(provider).toBeInstanceOf(MemoryEmailProvider);
    });

    it('should return null for non-existent provider', () => {
      const provider = testEmail.getProvider('non-existent');
      expect(provider).toBeNull();
    });

    it('should get all provider stats', () => {
      const stats = testEmail.getAllStats();
      expect(stats).toHaveProperty('memory');
      expect(stats.memory).toHaveProperty('provider', 'memory');
    });
  });

  describe('Send Functionality', () => {
    let testEmail;

    beforeEach(() => {
      testEmail = createFactory({ provider: 'memory' });
    });

    afterEach(() => {
      if (testEmail.removeCleanupHandlers) {
        testEmail.removeCleanupHandlers();
      }
    });

    describe('Single Email', () => {
      it('should send basic email with html', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Test Email',
              html: '<p>Hello World</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('messageId');
        expect(result.data).toHaveProperty('to', 'user@example.com');
        expect(result.data).toHaveProperty('provider', 'memory');
      });

      it('should send email with text content', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Text Email',
              text: 'Plain text content',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with both html and text', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Mixed Content',
              html: '<p>HTML content</p>',
              text: 'Text content',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with cc and bcc', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              cc: 'cc@example.com',
              bcc: ['bcc1@example.com', 'bcc2@example.com'],
              subject: 'CC/BCC Test',
              html: '<p>Test</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with custom from', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              from: 'custom@example.com',
              fromName: 'Custom Sender',
              subject: 'Custom From',
              html: '<p>Test</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with reply-to', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              replyTo: 'reply@example.com',
              subject: 'Reply-To Test',
              html: '<p>Test</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with attachments', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'With Attachment',
              html: '<p>See attachment</p>',
              attachments: [
                {
                  filename: 'test.txt',
                  content: Buffer.from('Hello'),
                  contentType: 'text/plain',
                },
              ],
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should send email with custom headers', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Custom Headers',
              html: '<p>Test</p>',
              headers: {
                'X-Custom-Header': 'custom-value',
              },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });
    });

    describe('Bulk Emails', () => {
      it('should send multiple emails', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user1@example.com',
              subject: 'Email 1',
              html: '<p>First</p>',
            },
            {
              to: 'user2@example.com',
              subject: 'Email 2',
              html: '<p>Second</p>',
            },
            {
              to: 'user3@example.com',
              subject: 'Email 3',
              html: '<p>Third</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.totalEmails).toBe(3);
        expect(result.data.successCount).toBe(3);
        expect(result.data.failCount).toBe(0);
        expect(result.data.successful).toHaveLength(3);
      });

      it('should handle partial failures', async () => {
        // Configure provider to fail randomly
        const failProvider = new MemoryEmailProvider({
          failureRate: 0.5, // 50% failure rate
        });

        const failEmail = createFactory({ provider: 'memory' });
        failEmail.providers.set('memory', failProvider);

        const emails = Array.from({ length: 6 }, (_, i) => ({
          to: `user${i}@example.com`,
          subject: `Email ${i}`,
          html: '<p>Test</p>',
        }));

        const result = await failEmail.send(emails, {
          useWorker: false,
          provider: 'memory',
        });

        expect(result.success).toBe(true);
        expect(result.data.totalEmails).toBe(6);
        expect(result.data.successCount + result.data.failCount).toBe(6);

        if (failEmail.removeCleanupHandlers) {
          failEmail.removeCleanupHandlers();
        }
      }, 20000); // 20s timeout to account for exponential backoff retries

      it('should track successful and failed recipients', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user1@example.com',
              subject: 'Test 1',
              html: '<p>Test</p>',
            },
            {
              to: 'user2@example.com',
              subject: 'Test 2',
              html: '<p>Test</p>',
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.data.successful).toHaveLength(2);
        expect(result.data.successful[0]).toHaveProperty('to');
        expect(result.data.successful[0]).toHaveProperty('messageId');
      });
    });

    describe('Template Rendering', () => {
      it('should render subject with template data', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Hello {{name}}',
              html: '<p>Test</p>',
              templateData: { name: 'John' },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should render html with template data', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Test',
              html: '<p>Hello {{name}}, you have {{count}} messages</p>',
              templateData: { name: 'Jane', count: 5 },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should render text with template data', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Test',
              text: 'Hello {{name}}, welcome to {{site}}',
              templateData: { name: 'Bob', site: 'Example.com' },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should handle complex template data with loops', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Test',
              html: '<ul>{% for item in items %}<li>{{item}}</li>{% endfor %}</ul>',
              templateData: { items: ['one', 'two', 'three'] },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });

      it('should handle conditional templates', async () => {
        const result = await testEmail.send(
          [
            {
              to: 'user@example.com',
              subject: 'Test',
              html: '{% if premium %}Premium User{% else %}Free User{% endif %}',
              templateData: { premium: true },
            },
          ],
          { useWorker: false, provider: 'memory' },
        );

        expect(result.success).toBe(true);
        expect(result.data.messageId).toBeDefined();
      });
    });
  });

  describe('Validation', () => {
    describe('Valid Inputs', () => {
      it('should validate single recipient', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate multiple recipients as array', () => {
        const result = validateEmails([
          {
            to: ['user1@example.com', 'user2@example.com'],
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate email with text content', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: 'Test',
            text: 'Plain text',
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate email with cc and bcc', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            cc: 'cc@example.com',
            bcc: ['bcc1@example.com', 'bcc2@example.com'],
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate email with attachments', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            attachments: [
              {
                filename: 'test.txt',
                content: Buffer.from('test'),
              },
            ],
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate email with templateId', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            templateId: 'welcome-email',
            templateData: { name: 'John' },
          },
        ]);

        expect(result.success).toBe(true);
      });

      it('should validate multiple emails in batch', () => {
        const result = validateEmails([
          { to: 'user1@example.com', subject: 'Test 1', html: '<p>1</p>' },
          { to: 'user2@example.com', subject: 'Test 2', html: '<p>2</p>' },
          { to: 'user3@example.com', subject: 'Test 3', html: '<p>3</p>' },
        ]);

        expect(result.success).toBe(true);
      });
    });

    describe('Invalid Inputs', () => {
      it('should reject empty array', () => {
        const result = validateEmails([]);
        expect(result.success).toBe(false);
      });

      it('should reject email without recipient', () => {
        const result = validateEmails([
          {
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(false);
      });

      it('should reject email without content', () => {
        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: 'Test',
          },
        ]);

        expect(result.success).toBe(false);
      });

      it('should reject invalid email address', () => {
        const result = validateEmails([
          {
            to: 'not-an-email',
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(false);
      });

      it('should reject too many recipients', () => {
        const tooManyRecipients = Array.from(
          { length: EMAIL_LIMITS.MAX_RECIPIENTS + 1 },
          (_, i) => `user${i}@example.com`,
        );

        const result = validateEmails([
          {
            to: tooManyRecipients,
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(false);
      });

      it('should reject too many emails in batch', () => {
        const tooManyEmails = Array.from(
          { length: EMAIL_LIMITS.MAX_BATCH_SIZE + 1 },
          (_, i) => ({
            to: `user${i}@example.com`,
            subject: 'Test',
            html: '<p>Test</p>',
          }),
        );

        const result = validateEmails(tooManyEmails);
        expect(result.success).toBe(false);
      });

      it('should reject too many attachments', () => {
        const tooManyAttachments = Array.from(
          { length: EMAIL_LIMITS.MAX_ATTACHMENTS + 1 },
          (_, i) => ({
            filename: `file${i}.txt`,
            content: Buffer.from('test'),
          }),
        );

        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            attachments: tooManyAttachments,
          },
        ]);

        expect(result.success).toBe(false);
      });

      it('should reject subject that is too long', () => {
        const longSubject = 'x'.repeat(999);

        const result = validateEmails([
          {
            to: 'user@example.com',
            subject: longSubject,
            html: '<p>Test</p>',
          },
        ]);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('Memory Provider', () => {
    let provider;

    beforeEach(() => {
      provider = new MemoryEmailProvider({
        defaultFrom: 'test@example.com',
        defaultFromName: 'Test Sender',
      });
      provider.clear();
    });

    it('should store sent emails', async () => {
      await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const sentEmails = provider.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toEqual(['user@example.com']);
    });

    it('should get last email', async () => {
      await provider.send({
        to: 'user1@example.com',
        subject: 'First',
        html: '<p>First</p>',
      });

      await provider.send({
        to: 'user2@example.com',
        subject: 'Last',
        html: '<p>Last</p>',
      });

      const lastEmail = provider.getLastEmail();
      expect(lastEmail.subject).toBe('Last');
      expect(lastEmail.to).toEqual(['user2@example.com']);
    });

    it('should get email by ID', async () => {
      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const email = provider.getEmailById(result.messageId);
      expect(email).toBeDefined();
      expect(email.id).toBe(result.messageId);
    });

    it('should filter emails by recipient', async () => {
      await provider.send({
        to: 'alice@example.com',
        subject: 'To Alice',
        html: '<p>Hi Alice</p>',
      });

      await provider.send({
        to: 'bob@example.com',
        subject: 'To Bob',
        html: '<p>Hi Bob</p>',
      });

      const aliceEmails = provider.getSentEmails({ to: 'alice' });
      expect(aliceEmails).toHaveLength(1);
      expect(aliceEmails[0].to).toContain('alice@example.com');
    });

    it('should filter emails by subject', async () => {
      await provider.send({
        to: 'user@example.com',
        subject: 'Welcome Email',
        html: '<p>Welcome</p>',
      });

      await provider.send({
        to: 'user@example.com',
        subject: 'Password Reset',
        html: '<p>Reset</p>',
      });

      const welcomeEmails = provider.getSentEmails({ subject: 'welcome' });
      expect(welcomeEmails).toHaveLength(1);
      expect(welcomeEmails[0].subject).toBe('Welcome Email');
    });

    it('should limit returned emails', async () => {
      for (let i = 0; i < 5; i++) {
        await provider.send({
          to: 'user@example.com',
          subject: `Email ${i}`,
          html: '<p>Test</p>',
        });
      }

      const limited = provider.getSentEmails({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should clear all stored emails', async () => {
      await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      provider.clear();

      const sentEmails = provider.getSentEmails();
      expect(sentEmails).toHaveLength(0);

      const stats = provider.getStats();
      expect(stats.sent).toBe(0);
    });

    it('should simulate failures when configured', async () => {
      const failProvider = new MemoryEmailProvider({ failureRate: 1.0 });

      await expect(
        failProvider.send({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Simulated email failure');

      const failedEmails = failProvider.getFailedEmails();
      expect(failedEmails).toHaveLength(1);
    });

    it('should track statistics', async () => {
      await provider.send({
        to: 'user1@example.com',
        subject: 'Test 1',
        html: '<p>Test</p>',
      });

      await provider.send({
        to: 'user2@example.com',
        subject: 'Test 2',
        html: '<p>Test</p>',
      });

      const stats = provider.getStats();
      expect(stats.provider).toBe('memory');
      expect(stats.sent).toBe(2);
      expect(stats.storedEmails).toBe(2);
      expect(stats.lastSentAt).toBeDefined();
    });

    it('should enforce max stored emails limit', async () => {
      const limitedProvider = new MemoryEmailProvider({
        maxStoredEmails: 3,
      });

      for (let i = 0; i < 5; i++) {
        await limitedProvider.send({
          to: `user${i}@example.com`,
          subject: `Email ${i}`,
          html: '<p>Test</p>',
        });
      }

      const sentEmails = limitedProvider.getSentEmails();
      expect(sentEmails).toHaveLength(3); // Only last 3 stored
    });

    it('should verify connection', async () => {
      const result = await provider.verify();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('memory');
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup resources', async () => {
      const instance = createFactory({ provider: 'memory' });
      const memProvider = instance.getProvider('memory');

      // Send some emails
      await memProvider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Cleanup should clear providers
      await instance.cleanup();

      expect(instance.providers.size).toBe(0);

      // Cleanup handlers
      if (instance.removeCleanupHandlers) {
        instance.removeCleanupHandlers();
      }
    });

    it('should get all provider stats', () => {
      const instance = createFactory({ provider: 'memory' });
      const stats = instance.getAllStats();

      expect(stats).toHaveProperty('memory');
      expect(stats.memory.provider).toBe('memory');

      if (instance.removeCleanupHandlers) {
        instance.removeCleanupHandlers();
      }
    });
  });
});
