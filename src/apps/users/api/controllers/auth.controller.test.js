/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as cookies from '@shared/cookies/index.js';
import { validateForm } from '@shared/validator/index.js';

import * as authService from '../services/auth.service.js';
import * as profileService from '../services/profile.service.js';
import * as sessionService from '../services/session.service.js';
import { generatePassword } from '../utils/password.js';

import * as authController from './auth.controller.js';

// Mock dependencies
jest.mock('@shared/validator', () => ({
  validateForm: jest.fn(),
}));

jest.mock('@shared/cookies', () => ({
  setTokenCookie: jest.fn(),
  setRefreshTokenCookie: jest.fn(),
  clearAllAuthCookies: jest.fn(),
  getRefreshTokenFromCookie: jest.fn(),
}));

jest.mock('../services/auth.service', () => ({
  registerUser: jest.fn(),
  authenticateUser: jest.fn(),
  logoutUser: jest.fn(),
  verifyEmail: jest.fn(),
  resetPasswordRequest: jest.fn(),
  resetPasswordConfirmation: jest.fn(),
}));

jest.mock('../services/profile.service', () => ({
  getUserWithProfile: jest.fn(),
}));

jest.mock('../services/session.service', () => ({
  issueTokenPair: jest.fn(async () => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })),
  rotateTokenPair: jest.fn(async () => ({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  })),
  revokeByToken: jest.fn(async () => 1),
}));

jest.mock('../utils/password', () => ({
  generatePassword: jest.fn(),
}));

describe('Auth Controller', () => {
  let req;
  let res;
  let mockHttp;
  let mockAuth;
  let mockJwt;
  let mockModels;
  let mockHook;
  let mockHookInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttp = {
      sendSuccess: jest.fn(),
      sendError: jest.fn(),
      sendValidationError: jest.fn(),
      sendServerError: jest.fn(),
      sendUnauthorized: jest.fn(),
      getClientIP: jest.fn(() => '127.0.0.1'),
      getUserAgent: jest.fn(() => 'Test Browser'),
    };

    mockAuth = {
      DEFAULT_ROLE: 'user',
      setTokenCookie: jest.fn(),
      setRefreshTokenCookie: jest.fn(),
      clearAllAuthCookies: jest.fn(),
      getRefreshTokenFromCookie: jest.fn(),
    };

    // Token pairs are minted by the session service, never by the JWT
    // instance — `generateTokenPair`/`refreshTokenPair` now throw.
    mockJwt = {
      forgetToken: jest.fn(),
      cache: {
        delete: jest.fn(),
      },
    };

    mockModels = {};

    mockHookInstance = { emit: jest.fn(), invoke: jest.fn() };
    mockHook = jest.fn().mockReturnValue(mockHookInstance);

    // resetMocks:true wipes factory implementations — restore them per test
    sessionService.issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    sessionService.rotateTokenPair.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    sessionService.revokeByToken.mockResolvedValue(1);

    // Setting up global req/res
    req = {
      body: {},
      params: {},
      query: {},
      app: {
        get: jest.fn(key => {
          switch (key) {
            case 'container':
              return {
                resolve: name => {
                  switch (name) {
                    case 'http':
                      return mockHttp;
                    case 'auth':
                      return mockAuth;
                    case 'jwt':
                      return mockJwt;
                    case 'models':
                      return mockModels;
                    case 'hook':
                      return mockHook;
                    default:
                      return null;
                  }
                },
                has: () => false,
              };
            default:
              return null;
          }
        }),
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
  });

  describe('register', () => {
    it('should validate input and register a user successfully', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };
      validateForm.mockReturnValue([true, null]);
      authService.registerUser.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        picture: 'pic.jpg',
      });

      await authController.register(req, res);

      expect(validateForm).toHaveBeenCalled();
      expect(authService.registerUser).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        expect.objectContaining({ defaultRoleName: 'user' }),
      );
      expect(sessionService.issueTokenPair).toHaveBeenCalled();
      expect(cookies.setTokenCookie).toHaveBeenCalledWith(res, 'access-token');
      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(
        res,
        expect.any(Object),
        201,
      );
    });

    it('should return validation error if input is invalid', async () => {
      validateForm.mockReturnValue([false, { email: 'Invalid email' }]);

      await authController.register(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        email: 'Invalid email',
      });
      expect(authService.registerUser).not.toHaveBeenCalled();
    });

    it('should handle UserAlreadyExistsError', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Already exists');
      error.name = 'UserAlreadyExistsError';
      authService.registerUser.mockRejectedValue(error);

      await authController.register(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'User with this email already exists',
        409,
      );
    });
  });

  describe('login', () => {
    it('should validate input and log in a user successfully', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      };
      validateForm.mockReturnValue([true, null]);
      authService.authenticateUser.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await authController.login(req, res);

      expect(authService.authenticateUser).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        expect.any(Object),
      );
      expect(cookies.setTokenCookie).toHaveBeenCalledWith(
        res,
        'access-token',
        {},
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should set session cookie if rememberMe is false', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
      };
      validateForm.mockReturnValue([true, null]);
      authService.authenticateUser.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await authController.login(req, res);

      expect(cookies.setTokenCookie).toHaveBeenCalledWith(res, 'access-token', {
        maxAge: null,
      });
    });

    it('should return unauthorized on InvalidCredentialsError', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Invalid');
      error.name = 'InvalidCredentialsError';
      authService.authenticateUser.mockRejectedValue(error);

      await authController.login(req, res);

      expect(mockHttp.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'Invalid email or password',
      );
    });

    it('should not reveal whether the email exists (UserNotFoundError)', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('User not found');
      error.name = 'UserNotFoundError';
      authService.authenticateUser.mockRejectedValue(error);

      await authController.login(req, res);

      expect(mockHttp.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'Invalid email or password',
      );
    });
  });

  describe('logout', () => {
    it('should log out user and clear cookies', async () => {
      req.user = { id: 1 };
      req.token = 'some-token';

      await authController.logout(req, res);

      expect(authService.logoutUser).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
      expect(sessionService.revokeByToken).toHaveBeenCalled();
      expect(cookies.clearAllAuthCookies).toHaveBeenCalledWith(res);
      expect(mockJwt.forgetToken).toHaveBeenCalledWith('some-token');
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should handle missing user cleanly', async () => {
      await authController.logout(req, res);

      expect(authService.logoutUser).not.toHaveBeenCalled();
      expect(cookies.clearAllAuthCookies).toHaveBeenCalledWith(res);
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      cookies.getRefreshTokenFromCookie.mockReturnValue('valid-refresh-token');

      await authController.refreshToken(req, res);

      expect(sessionService.rotateTokenPair).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({ jwt: mockJwt, models: mockModels }),
      );
      expect(cookies.setTokenCookie).toHaveBeenCalledWith(
        res,
        'new-access-token',
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return unauthorized if no refresh token provided', async () => {
      cookies.getRefreshTokenFromCookie.mockReturnValue(null);

      await authController.refreshToken(req, res);

      expect(mockHttp.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'Refresh token required',
      );
    });

    it('should return unauthorized for TokenExpiredError', async () => {
      cookies.getRefreshTokenFromCookie.mockReturnValue('expired-token');
      const error = new Error('Expired');
      error.name = 'TokenExpiredError';
      error.status = 401;
      sessionService.rotateTokenPair.mockRejectedValueOnce(error);

      await authController.refreshToken(req, res);

      expect(mockHttp.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'Refresh token has expired',
      );
      expect(cookies.clearAllAuthCookies).toHaveBeenCalledWith(res);
    });

    it('reports a concurrent rotation as retryable and keeps the cookies', async () => {
      cookies.getRefreshTokenFromCookie.mockReturnValue('racing-token');
      const error = new Error('Refresh token is already being rotated');
      error.name = 'RefreshTokenRotationConflictError';
      error.status = 409;
      sessionService.rotateTokenPair.mockRejectedValueOnce(error);

      await authController.refreshToken(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Token refresh already in progress',
        409,
      );
      expect(cookies.clearAllAuthCookies).not.toHaveBeenCalled();
      expect(mockHttp.sendServerError).not.toHaveBeenCalled();
    });

    it('should reject a replayed (already rotated) refresh token', async () => {
      cookies.getRefreshTokenFromCookie.mockReturnValue('replayed-token');
      const error = new Error('reused');
      error.name = 'RefreshTokenReuseError';
      error.status = 401;
      sessionService.rotateTokenPair.mockRejectedValueOnce(error);

      await authController.refreshToken(req, res);

      expect(mockHttp.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'Session is no longer valid',
      );
      expect(cookies.clearAllAuthCookies).toHaveBeenCalledWith(res);
    });
  });

  describe('emailVerification', () => {
    it('should verify email and return tokens', async () => {
      req.body = { token: 'verify-token' };
      validateForm.mockReturnValue([true, null]);
      authService.verifyEmail.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await authController.emailVerification(req, res);

      expect(authService.verifyEmail).toHaveBeenCalledWith(
        'verify-token',
        expect.any(Object),
      );
      expect(cookies.setTokenCookie).toHaveBeenCalledWith(res, 'access-token');
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('resetPasswordRequest', () => {
    it('should process password reset request', async () => {
      req.body = { email: 'test@example.com' };
      validateForm.mockReturnValue([true, null]);

      await authController.resetPasswordRequest(req, res);

      expect(authService.resetPasswordRequest).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('resetPasswordConfirmation', () => {
    it('should confirm reset password', async () => {
      req.body = {
        token: 'reset-token',
        password: 'newPassword123!',
        confirmPassword: 'newPassword123!',
      };
      validateForm.mockReturnValue([true, null]);

      await authController.resetPasswordConfirmation(req, res);

      expect(authService.resetPasswordConfirmation).toHaveBeenCalledWith(
        'reset-token',
        'newPassword123!',
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('generateRandomPassword', () => {
    it('should orchestrate password generation successfully', async () => {
      generatePassword.mockReturnValue('SecureP@ssw0rd!');
      req.query = { length: '16', includeSymbols: 'true' };

      await authController.generateRandomPassword(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(res, {
        password: 'SecureP@ssw0rd!',
      });
    });
  });
});
