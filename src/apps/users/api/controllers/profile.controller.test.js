import { validateForm } from '@shared/validator';

import * as profileService from '../services/profile.service';
import { formatUserResponse } from '../utils/formatter';

import * as profileController from './profile.controller';

jest.mock('@shared/validator', () => ({
  validateForm: jest.fn(),
  z: { object: jest.fn() },
}));

jest.mock('../../validator/auth', () => ({
  updateProfileFormSchema: jest.fn(() => ({})),
  changePasswordFormSchema: jest.fn(() => ({})),
  deleteAccountFormSchema: jest.fn(() => ({})),
  updatePreferencesFormSchema: jest.fn(() => ({})),
}));

jest.mock('../services/profile.service', () => ({
  getUserWithProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  changeUserPassword: jest.fn(),
  updateUserPreferences: jest.fn(),
  getUserPreferences: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

jest.mock('../utils/formatter', () => ({
  formatUserResponse: jest.fn(user => ({ ...user, formatted: true })),
}));

describe('Profile Controller', () => {
  let req;
  let res;
  let mockHttp;
  let mockAuth;
  let mockModels;
  let mockFs;
  let mockWebhook;
  let mockHook;
  let mockHookInstance;
  let mockI18n;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttp = {
      sendSuccess: jest.fn(),
      sendError: jest.fn(),
      sendValidationError: jest.fn(),
      sendServerError: jest.fn(),
      sendNotFound: jest.fn(),
    };

    mockAuth = {
      ADMIN_ROLE: 'admin',
      DEFAULT_ROLE: 'user',
      DEFAULT_RESOURCES: {},
      DEFAULT_ACTIONS: {},
      clearAllAuthCookies: jest.fn(),
    };

    mockModels = {
      UserProfile: {
        upsert: jest.fn(),
        destroy: jest.fn(),
      },
    };

    mockFs = {
      MIDDLEWARES: { UPLOAD: 'uploadResult' },
      remove: jest.fn(),
      preview: jest.fn(),
    };

    mockWebhook = {};
    mockI18n = {};

    mockHookInstance = { emit: jest.fn() };
    const hookFactory = jest.fn().mockReturnValue(mockHookInstance);
    hookFactory.withContext = jest.fn().mockReturnValue(hookFactory);
    mockHook = hookFactory;

    req = {
      user: { id: 1 },
      body: {},
      params: {},
      query: {},
      app: {
        get: jest.fn(key => {
          const deps = {
            http: mockHttp,
            auth: mockAuth,
            models: mockModels,
            fs: mockFs,
            webhook: mockWebhook,
            hook: mockHook,
            i18n: mockI18n,
            container: { resolve: jest.fn() },
          };
          return deps[key];
        }),
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      redirect: jest.fn(),
      end: jest.fn(),
    };
  });

  describe('getProfile', () => {
    it('should get formatted profile successfully', async () => {
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await profileController.getProfile(req, res);

      expect(profileService.getUserWithProfile).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
      expect(formatUserResponse).toHaveBeenCalled();
      expect(mockHookInstance.emit).toHaveBeenCalledWith(
        'retrieved',
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      profileService.getUserWithProfile.mockResolvedValue(null);

      await profileController.getProfile(req, res);

      expect(mockHttp.sendNotFound).toHaveBeenCalledWith(res, 'User not found');
    });
  });

  describe('updateProfile', () => {
    it('should validate and update user profile', async () => {
      req.body = { firstName: 'John' };
      validateForm.mockReturnValue([true, { firstName: 'John' }]);
      profileService.updateUserProfile.mockResolvedValue({
        id: 1,
        firstName: 'John',
      });

      await profileController.updateProfile(req, res);

      expect(profileService.updateUserProfile).toHaveBeenCalledWith(
        1,
        { firstName: 'John' },
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return validation error if input is invalid', async () => {
      validateForm.mockReturnValue([false, { firstName: 'Required' }]);

      await profileController.updateProfile(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        firstName: 'Required',
      });
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar and update profile', async () => {
      req.uploadResult = { success: true, data: { fileName: 'avatar.png' } };
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        profile: { picture: 'old.png' },
      });

      await profileController.uploadAvatar(req, res);

      expect(mockModels.UserProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ attribute_value: 'avatar.png' }),
      );
      expect(mockFs.remove).toHaveBeenCalledWith('old.png');
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should delete old avatar cleanly without throwing if missing', async () => {
      req.uploadResult = { success: true, data: { fileName: 'avatar.png' } };
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        profile: { picture: 'missing.png' },
      });
      mockFs.remove.mockRejectedValue(new Error('File not found'));

      await profileController.uploadAvatar(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return validation error if uploadResult fails', async () => {
      req.uploadResult = { success: false, error: 'Upload failed' };

      await profileController.uploadAvatar(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        avatar: 'Upload failed',
      });
    });
  });

  describe('previewAvatar', () => {
    it('should stream local avatar file', async () => {
      req.query = { fileName: 'local-file.png' };
      const pipeMock = jest.fn();
      mockFs.preview.mockResolvedValue({
        success: true,
        data: {
          headers: { 'Content-Type': 'image/png' },
          stream: { pipe: pipeMock },
        },
      });

      await profileController.previewAvatar(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(pipeMock).toHaveBeenCalledWith(res);
    });

    it('should redirect external URL', async () => {
      req.query = { fileName: 'https://example.com/avatar.png' };

      await profileController.previewAvatar(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://example.com/avatar.png',
      );
    });

    it('should fallback securely to default avatar on fail', async () => {
      req.user.profile = { picture: null };

      await profileController.previewAvatar(req, res);

      expect(res.redirect).toHaveBeenCalled();
    });
  });

  describe('removeAvatar', () => {
    it('should remove avatar and clean DB', async () => {
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        profile: { picture: 'avatar.png' },
      });

      await profileController.removeAvatar(req, res);

      expect(mockFs.remove).toHaveBeenCalledWith('avatar.png');
      expect(mockModels.UserProfile.destroy).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return error if no avatar exists', async () => {
      profileService.getUserWithProfile.mockResolvedValue({
        id: 1,
        profile: {},
      });

      await profileController.removeAvatar(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should validate and change user password', async () => {
      req.body = {
        currentPassword: '1',
        newPassword: '2',
        confirmNewPassword: '2',
      };
      validateForm.mockReturnValue([true, null]);

      await profileController.changePassword(req, res);

      expect(profileService.changeUserPassword).toHaveBeenCalledWith(
        1,
        '1',
        '2',
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should catch InvalidPasswordError', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Bad pwd');
      error.name = 'InvalidPasswordError';
      profileService.changeUserPassword.mockRejectedValue(error);

      await profileController.changePassword(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        currentPassword: expect.any(String),
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      validateForm.mockReturnValue([true, null]);
      profileService.updateUserPreferences.mockResolvedValue({
        timezone: 'UTC',
      });

      await profileController.updatePreferences(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPreferences', () => {
    it('should return preferences', async () => {
      profileService.getUserPreferences.mockResolvedValue({ theme: 'dark' });

      await profileController.getPreferences(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(res, {
        preferences: { theme: 'dark' },
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and clear cookies', async () => {
      validateForm.mockReturnValue([true, null]);

      await profileController.deleteAccount(req, res);

      expect(profileService.deleteUserAccount).toHaveBeenCalled();
      expect(mockAuth.clearAllAuthCookies).toHaveBeenCalledWith(res);
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });
});
