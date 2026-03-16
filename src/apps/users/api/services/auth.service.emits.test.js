import { createFactory } from '@shared/api/engines/hook/factory';

import {
  createTimedResetToken,
  validateResetToken,
  verifyPassword,
} from '../utils/password';

import * as authService from './auth.service';

// Mock password utilities where needed
jest.mock('../utils/password', () => ({
  createTimedResetToken: jest.fn(() => ({
    token: 'tok1',
    hashedToken: 'hashed',
    expiresAt: Date.now() + 3600,
  })),
  hashToken: jest.fn(token => `hashed_${token}`),
  validateResetToken: jest.fn(() => ({ valid: true, errors: [] })),
  verifyPassword: jest.fn(() => true),
}));

describe('auth.service emits (additional)', () => {
  test('registerUser emits registered', async () => {
    const factory = createFactory();
    const ctx = { app: 'ctx' };
    const hook = factory.withContext(ctx);

    let called = false;
    const user = { id: 'u1', email: 'test@example.com' };

    const models = {
      User: {
        findOne: jest.fn(async () => null),
        create: jest.fn(async () => user),
      },
      UserProfile: {},
      Role: {
        findOne: jest.fn(async () => ({ id: 'r1', name: 'default' })),
      },
    };

    // Ensure user.addRole exists after create
    user.addRole = jest.fn();

    const authChannel = hook('auth');
    authChannel.on('registered', function (payload) {
      expect(this).toBe(ctx);
      expect(payload.user_id).toEqual(user.id);
      expect(payload.email).toEqual(user.email);
      expect(payload.user).toBeDefined();
      called = true;
    });

    await authService.registerUser(
      { email: user.email, password: 'p' },
      { models, hook },
    );

    expect(called).toBe(true);
  });

  test('authenticateUser emits login', async () => {
    const factory = createFactory();
    const ctx = { app: 'ctx2' };
    const hook = factory.withContext(ctx);

    let called = false;
    const dbUser = {
      id: 'u2',
      email: 'u2@example.com',
      password: 'hashed',
      failed_login_attempts: 0,
      is_active: true,
      is_locked: false,
    };

    // Mock scoped findOne
    const UserScope = {
      findOne: jest.fn(async () => dbUser),
    };

    const models = {
      User: {
        scope: jest.fn(() => UserScope),
        update: jest.fn(),
      },
      UserProfile: {},
      Role: { findOne: jest.fn() },
      Permission: {},
      Group: {},
    };

    const activitiesData = { ip_address: '1.2.3.4' };

    const authChannel = hook('auth');
    authChannel.on('logged_in', function (payload) {
      expect(this).toBe(ctx);
      expect(payload.user_id).toBe(dbUser.id);
      expect(payload.activitiesData).toEqual(activitiesData);
      expect(payload.user).toBeDefined();
      called = true;
    });

    const result = await authService.authenticateUser('email', 'pass', {
      models,
      activitiesData,
      hook,
    });

    expect(called).toBe(true);
    expect(verifyPassword).toHaveBeenCalled();

    // Result should include RBAC data (roles array at minimum)
    expect(result).toHaveProperty('roles');
    expect(Array.isArray(result.roles)).toBe(true);
    // Default role should be present when no roles set on user
    expect(result.roles).toContain('user');
  });

  test('verifyEmail emits email_verified', async () => {
    const factory = createFactory();
    const ctx = { app: 'ctx3' };
    const hook = factory.withContext(ctx);

    let called = false;
    const user = {
      id: 'u3',
      email_confirmed: false,
      email: 'u3@example.com',
      update: jest.fn(),
    };

    const models = {
      User: {
        findByPk: jest.fn(async () => user),
      },
    };

    const authChannel = hook('auth');
    authChannel.on('email_verified', function (payload) {
      expect(this).toBe(ctx);
      expect(payload).toEqual({ user_id: user.id, email: user.email });
      called = true;
    });

    await authService.verifyEmail(user.id, { models, hook });

    expect(called).toBe(true);
  });

  test('resetPasswordRequest emits password_reset_requested', async () => {
    const factory = createFactory();
    const ctx = { app: 'ctx4' };
    const hook = factory.withContext(ctx);

    let called = false;
    const user = { id: 'u4', email: 'u4@example.com' };

    const models = {
      User: {
        findOne: jest.fn(async () => user),
      },
      PasswordResetToken: {
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const authChannel = hook('auth');
    authChannel.on('password_reset_requested', function (payload) {
      expect(this).toBe(ctx);
      expect(payload.user_id).toEqual(user.id);
      expect(payload.email).toEqual(user.email);
      expect(payload.resetLink).toBeDefined();
      called = true;
    });

    // ensure event registered on channel
    expect(hook('auth').events).toContain('password_reset_requested');

    await authService.resetPasswordRequest(user.email, {
      models,
      hook,
    });

    expect(called).toBe(true);
    expect(createTimedResetToken).toHaveBeenCalled();
  });

  test('resetPasswordConfirmation emits password_reset_completed', async () => {
    const factory = createFactory();
    const ctx = { app: 'ctx5' };
    const hook = factory.withContext(ctx);

    let called = false;

    const tokenRecord = {
      hashed_token: 'hashed_val',
      user_id: 'u5',
      expires_at: Date.now() + 10000,
      used_at: null,
      update: jest.fn(),
    };

    const models = {
      User: {
        findByPk: jest.fn(async () => ({ id: 'u5', update: jest.fn() })),
      },
      PasswordResetToken: {
        findOne: jest.fn(async () => tokenRecord),
      },
    };

    const authChannel = hook('auth');
    authChannel.on('password_reset_completed', function (payload) {
      expect(this).toBe(ctx);
      expect(payload).toEqual({ user_id: 'u5' });
      called = true;
    });

    await authService.resetPasswordConfirmation('token123', 'newpass', {
      models,
      hook,
    });

    expect(called).toBe(true);
    expect(validateResetToken).toHaveBeenCalled();
  });
});
