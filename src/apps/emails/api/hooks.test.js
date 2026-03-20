import { createFactory as createEmailFactory } from '@shared/api/engines/email/factory';
import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';

import { registerEmailHooks } from './hooks';

describe('Email Hooks', () => {
  let container;
  let hook;
  let emailManager;
  let models;

  beforeEach(() => {
    hook = createHookFactory();
    emailManager = createEmailFactory();

    // Mock the send method
    emailManager.send = jest.fn().mockResolvedValue(true);

    // Mock models
    models = {
      EmailTemplate: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    };

    container = {
      resolve: jest.fn(name => {
        if (name === 'hook') return hook;
        if (name === 'email') return emailManager;
        if (name === 'models') return models;
        return null;
      }),
    };

    // Register hooks
    registerEmailHooks(container);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('auth hooks', () => {
    test('sends welcome email on auth:registered', async () => {
      const payload = {
        email: 'test@example.com',
        user: { id: '123', profile: { display_name: 'Test User' } },
      };

      await hook('auth').emit('registered', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.any(String),
        html: expect.stringContaining('{{displayName}}'),
        templateData: expect.objectContaining({
          displayName: 'Test User',
        }),
      });
    });

    test('uses database template when available', async () => {
      const payload = {
        email: 'test@example.com',
        user: { id: '123', profile: { display_name: 'Test Temp' } },
      };

      models.EmailTemplate.findOne.mockResolvedValueOnce({
        subject: 'Custom DB Subject: {{displayName}}',
        html_body: '<p>Custom DB HTML: {{displayName}}</p>',
      });

      await hook('auth').emit('registered', payload);

      expect(models.EmailTemplate.findOne).toHaveBeenCalledWith({
        where: { slug: 'welcome-email', is_active: true },
      });

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: 'Custom DB Subject: {{displayName}}',
        html: '<p>Custom DB HTML: {{displayName}}</p>',
        templateData: expect.objectContaining({
          displayName: 'Test Temp',
        }),
      });
    });

    test('sends password reset email on auth:password_reset_requested', async () => {
      const payload = {
        email: 'test@example.com',
        resetLink: 'http://localhost/reset?token=123',
      };

      await hook('auth').emit('password_reset_requested', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Password Reset'),
        html: expect.stringContaining('{{resetLink}}'),
        templateData: expect.objectContaining({
          resetLink: payload.resetLink,
        }),
      });
    });
  });

  describe('admin:users hooks', () => {
    test('sends email on admin:users:created', async () => {
      const payload = {
        email: 'testadmin@example.com',
        password: 'securePassword123!',
        user: { id: '456', profile: { display_name: 'Admin Created' } },
      };

      await hook('admin:users').emit('created', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.any(String),
        html: expect.stringContaining('{{displayName}}'),
        templateData: expect.objectContaining({
          displayName: 'Admin Created',
          password: payload.password,
        }),
      });
    });

    test('sends notification on admin:users:status_updated', async () => {
      const payload = {
        email: 'teststatus@example.com',
        is_active: false,
      };

      await hook('admin:users').emit('status_updated', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Account Status Update'),
        html: expect.stringContaining('{{status}}'),
        templateData: expect.objectContaining({
          status: 'Inactive',
        }),
      });
    });
  });

  describe('profile hooks', () => {
    test('sends notification on profile:password_changed', async () => {
      const payload = {
        email: 'user@example.com',
        user_id: '789',
      };

      await hook('profile').emit('password_changed', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Password Was Changed'),
        html: expect.stringContaining('{{appName}}'),
        templateData: expect.objectContaining({
          appName: process.env.RSK_APP_NAME,
        }),
      });
    });

    test('sends notification on profile:account_deleted', async () => {
      const payload = {
        email: 'deleted@example.com',
        user_id: '999',
      };

      await hook('profile').emit('account_deleted', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Account Has Been Removed'),
        html: expect.stringContaining('{{appName}}'),
        templateData: expect.objectContaining({
          appName: process.env.RSK_APP_NAME,
        }),
      });
    });
  });

  describe('files hooks', () => {
    test('sends notification on files:shared', async () => {
      const payload = {
        email: 'recipient@example.com',
        sharerEmail: 'sharer@example.com',
      };

      await hook('files').emit('shared', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('New File Shared With You'),
        html: expect.stringContaining('{{sharerEmail}}'),
        templateData: expect.objectContaining({
          sharerEmail: 'sharer@example.com',
        }),
      });
    });
  });
});
