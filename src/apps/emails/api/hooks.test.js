import { createFactory as createEmailFactory } from '@shared/api/engines/email/factory';
import { createFactory as createHookFactory } from '@shared/api/engines/hook/factory';

import { registerEmailHooks } from './hooks';
import { createSendTemplatedEmail } from './services/send.service';

describe('Email Hooks', () => {
  let container;
  let hook;
  let emailManager;
  let models;
  let sendTemplatedEmail;

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

    // Create the real sendTemplatedEmail bound to mocked services
    const serviceContainer = {
      resolve: jest.fn(name => {
        if (name === 'email') return emailManager;
        if (name === 'models') return models;
        return null;
      }),
    };
    sendTemplatedEmail = createSendTemplatedEmail(serviceContainer);

    container = {
      resolve: jest.fn(name => {
        if (name === 'hook') return hook;
        if (name === 'emails:send') return sendTemplatedEmail;
        return null;
      }),
    };

    // Register hooks
    registerEmailHooks(container);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Shared assertions
  // ---------------------------------------------------------------------------

  /** Assert common baseVars are present in every email */
  const expectBaseVars = templateData => {
    expect(templateData).toEqual(
      expect.objectContaining({
        appName: process.env.XNAPIFY_PUBLIC_APP_NAME,
        loginUrl: expect.stringContaining('/login'),
        resetUrl: expect.stringContaining('/auth/reset'),
        supportUrl: expect.stringContaining('/support'),
        now: expect.any(String),
        year: new Date().getFullYear(),
      }),
    );
  };

  // ---------------------------------------------------------------------------
  // emails:* — public API for extensions
  // ---------------------------------------------------------------------------

  describe('emails:send hook (public API)', () => {
    test('sends email with DB template slug', async () => {
      await hook('emails').emit('send', {
        slug: 'order-confirmation',
        to: 'customer@example.com',
        subject: 'Order #123',
        html: '<p>Fallback</p>',
        data: { orderId: 123 },
      });

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: 'customer@example.com',
        subject: 'Order #123',
        templateData: expect.objectContaining({ orderId: 123 }),
      });
      expectBaseVars(callArgs[0].templateData);
    });

    test('sends inline template when no slug provided', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi {{ name }}</p>',
        data: { name: 'Jane' },
      });

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: 'user@example.com',
        html: '<p>Hi {{ name }}</p>',
        templateData: expect.objectContaining({ name: 'Jane' }),
      });
    });

    // --- Validation: required fields ---

    test('rejects undefined payload', async () => {
      await hook('emails').emit('send', undefined);
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects non-object payload', async () => {
      await hook('emails').emit('send', 'not-an-object');
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects missing "to"', async () => {
      await hook('emails').emit('send', {
        subject: 'No recipient',
        html: '<p>Oops</p>',
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects invalid email address', async () => {
      await hook('emails').emit('send', {
        to: 'not-an-email',
        html: '<p>Hi</p>',
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    // --- Validation: optional fields ---

    test('rejects invalid slug format', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        slug: 'Bad Slug!',
        html: '<p>Hi</p>',
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects non-string subject', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        subject: 123,
        html: '<p>Hi</p>',
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects non-string html', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        html: { body: '<p>' },
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects array as data', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        html: '<p>Hi</p>',
        data: ['not', 'an', 'object'],
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('rejects when neither html nor slug provided', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        subject: 'No content',
      });
      expect(emailManager.send).not.toHaveBeenCalled();
    });

    test('accepts slug-only (no html) for DB template lookup', async () => {
      await hook('emails').emit('send', {
        to: 'user@example.com',
        slug: 'welcome-email',
      });
      expect(emailManager.send).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // auth:* hooks
  // ---------------------------------------------------------------------------

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
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('displayName'),
        templateData: expect.objectContaining({
          displayName: 'Test User',
          subject: expect.any(String),
        }),
      });
      expectBaseVars(callArgs[0].templateData);
    });

    test('sends welcome email with fallback displayName', async () => {
      const payload = {
        email: 'no-profile@example.com',
        user: { id: '999' },
      };

      await hook('auth').emit('registered', payload);

      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0].templateData.displayName).toBe('there');
    });

    test('uses database template when available', async () => {
      const payload = {
        email: 'test@example.com',
        user: { id: '123', profile: { display_name: 'Test Temp' } },
      };

      models.EmailTemplate.findOne.mockResolvedValueOnce({
        subject: 'Custom DB Subject: {{ displayName }}',
        html_body: '<p>Custom DB HTML: {{ displayName }}</p>',
        text_body: 'Custom plain text: {{ displayName }}',
      });

      await hook('auth').emit('registered', payload);

      expect(models.EmailTemplate.findOne).toHaveBeenCalledWith({
        where: { slug: 'welcome-email', is_active: true },
      });

      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: 'Custom DB Subject: {{ displayName }}',
        html: '<p>Custom DB HTML: {{ displayName }}</p>',
        text: 'Custom plain text: {{ displayName }}',
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
        html: expect.stringContaining('resetLink'),
        templateData: expect.objectContaining({
          resetLink: payload.resetLink,
        }),
      });
      expectBaseVars(callArgs[0].templateData);
    });
  });

  // ---------------------------------------------------------------------------
  // admin:users:* hooks
  // ---------------------------------------------------------------------------

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
        html: expect.stringContaining('displayName'),
        templateData: expect.objectContaining({
          displayName: 'Admin Created',
          password: payload.password,
          email: payload.email,
        }),
      });
      expectBaseVars(callArgs[0].templateData);
    });

    test('sends notification on admin:users:password_reset', async () => {
      const payload = {
        email: 'testpw@example.com',
        password: 'newTempPass!',
      };

      await hook('admin:users').emit('password_reset', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Password Was Reset'),
        templateData: expect.objectContaining({
          password: payload.password,
        }),
      });
    });

    test('sends notification on admin:users:status_updated (deactivate)', async () => {
      const payload = {
        email: 'teststatus@example.com',
        is_active: false,
      };

      await hook('admin:users').emit('status_updated', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Inactive'),
        templateData: expect.objectContaining({
          status: 'Inactive',
          is_active: false,
        }),
      });
    });

    test('sends notification on admin:users:status_updated (activate)', async () => {
      const payload = {
        email: 'teststatus@example.com',
        is_active: true,
      };

      await hook('admin:users').emit('status_updated', payload);

      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0].templateData).toMatchObject({
        status: 'Active',
        is_active: true,
      });
    });

    test('sends notification on admin:users:deleted', async () => {
      const payload = { email: 'deleted@example.com' };

      await hook('admin:users').emit('deleted', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Removed'),
      });
      expectBaseVars(callArgs[0].templateData);
    });
  });

  // ---------------------------------------------------------------------------
  // profile:* hooks
  // ---------------------------------------------------------------------------

  describe('profile hooks', () => {
    test('sends notification on profile:password_changed', async () => {
      const payload = { email: 'user@example.com' };

      await hook('profile').emit('password_changed', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Password Changed'),
        templateData: expect.objectContaining({
          resetUrl: expect.stringContaining('/auth/reset'),
        }),
      });
      expectBaseVars(callArgs[0].templateData);
    });

    test('sends notification on profile:account_deleted', async () => {
      const payload = { email: 'deleted@example.com' };

      await hook('profile').emit('account_deleted', payload);

      expect(emailManager.send).toHaveBeenCalledTimes(1);
      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        to: payload.email,
        subject: expect.stringContaining('Account Deleted'),
      });
      expectBaseVars(callArgs[0].templateData);
    });
  });

  // ---------------------------------------------------------------------------
  // files:* hooks
  // ---------------------------------------------------------------------------

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
        subject: expect.stringContaining('shared a file'),
        templateData: expect.objectContaining({
          sharerEmail: 'sharer@example.com',
          driveUrl: expect.stringContaining('/drive'),
        }),
      });
      expectBaseVars(callArgs[0].templateData);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('resilience', () => {
    test('handles emailManager.send failure gracefully', async () => {
      emailManager.send.mockRejectedValueOnce(new Error('SMTP timeout'));

      // Should not throw
      await hook('auth').emit('registered', {
        email: 'fail@example.com',
        user: { id: '1' },
      });

      expect(emailManager.send).toHaveBeenCalledTimes(1);
    });

    test('skips hooks when dependencies are missing', () => {
      const emptyContainer = {
        resolve: jest.fn(() => null),
      };

      // Should not throw
      expect(() => registerEmailHooks(emptyContainer)).not.toThrow();
    });

    test('subject is injected into templateData', async () => {
      await hook('auth').emit('registered', {
        email: 'test@example.com',
        user: { id: '1' },
      });

      const callArgs = emailManager.send.mock.calls[0];
      expect(callArgs[0].templateData.subject).toBe(callArgs[0].subject);
    });
  });
});

// ---------------------------------------------------------------------------
// send.service unit tests
// ---------------------------------------------------------------------------

describe('createSendTemplatedEmail', () => {
  test('returns a no-op when email service is missing', async () => {
    const emptyContainer = { resolve: () => null };
    const send = createSendTemplatedEmail(emptyContainer);

    // Should not throw
    await expect(
      send('test-slug', { to: 'a@b.com', subject: 'x', html: 'y' }),
    ).resolves.toBeUndefined();
  });

  test('auto-injects baseVars into templateData', async () => {
    const mockSend = jest.fn().mockResolvedValue(true);
    const serviceContainer = {
      resolve: name => {
        if (name === 'email') return { send: mockSend };
        if (name === 'models')
          return {
            EmailTemplate: { findOne: jest.fn().mockResolvedValue(null) },
          };
        return null;
      },
    };
    const send = createSendTemplatedEmail(serviceContainer);

    await send(
      'test',
      { to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' },
      { custom: 'val' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const { templateData } = mockSend.mock.calls[0][0];
    expect(templateData).toEqual(
      expect.objectContaining({
        custom: 'val',
        subject: 'Hi',
        now: expect.any(String),
        year: expect.any(Number),
      }),
    );
    // baseVars keys are present (values depend on env)
    expect('appName' in templateData).toBe(true);
    expect('loginUrl' in templateData).toBe(true);
    expect('resetUrl' in templateData).toBe(true);
    expect('supportUrl' in templateData).toBe(true);
  });
});
