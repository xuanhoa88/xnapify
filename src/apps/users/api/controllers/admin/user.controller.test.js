import { validateForm } from '@shared/validator';

import * as userAdminService from '../../services/admin/user.service';

import * as userController from './user.controller';

jest.mock('@shared/validator', () => ({
  validateForm: jest.fn(),
  z: { object: jest.fn() },
}));

jest.mock('../../../validator/admin', () => ({
  updateUserFormSchema: jest.fn(() => ({})),
  createUserFormSchema: jest.fn(() => ({})),
  bulkUpdateUserStatusFormSchema: jest.fn(() => ({})),
  bulkDeleteUserFormSchema: jest.fn(() => ({})),
  createApiKeyFormSchema: jest.fn(() => ({})),
}));

jest.mock('../../services/admin/user.service', () => ({
  createUser: jest.fn(),
  getUserList: jest.fn(),
  getUserById: jest.fn(),
  updateUserById: jest.fn(),
  bulkUpdateStatus: jest.fn(),
  bulkDelete: jest.fn(),
  exportUsers: jest.fn(),
  listApiKeys: jest.fn(),
  createApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
}));

describe('Admin User Controller', () => {
  let req;
  let res;
  let mockHttp;
  let mockModels;
  let mockHook;
  let mockAuth;
  let mockJwt;
  let mockCache;
  let mockHookInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttp = {
      sendSuccess: jest.fn(),
      sendError: jest.fn(),
      sendValidationError: jest.fn(),
      sendServerError: jest.fn(),
      sendNotFound: jest.fn(),
      getPagination: jest.fn(() => ({ page: 1, limit: 10 })),
    };

    mockModels = {};
    mockAuth = { DEFAULT_ROLE: 'user' };
    mockJwt = {};
    mockCache = {};

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
            models: mockModels,
            hook: mockHook,
            auth: mockAuth,
            jwt: mockJwt,
            cache: mockCache,
            container: { resolve: jest.fn() },
          };
          return deps[key];
        }),
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('createUser', () => {
    it('should validate and create user successfully', async () => {
      req.body = { email: 'test@example.com' };
      validateForm.mockReturnValue([true, null]);
      userAdminService.createUser.mockResolvedValue({
        id: 2,
        email: 'test@example.com',
      });

      await userController.createUser(req, res);

      expect(userAdminService.createUser).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return error if email already exists', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Exists');
      error.name = 'UserAlreadyExistsError';
      userAdminService.createUser.mockRejectedValue(error);

      await userController.createUser(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalled();
    });
  });

  describe('getUserList', () => {
    it('should parse pagination and get list', async () => {
      userAdminService.getUserList.mockResolvedValue({
        users: [],
        pagination: {},
      });

      await userController.getUserList(req, res);

      expect(userAdminService.getUserList).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should find and return user', async () => {
      req.params = { id: 2 };
      userAdminService.getUserById.mockResolvedValue({ id: 2 });

      await userController.getUserById(req, res);

      expect(userAdminService.getUserById).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return server error if user not found since controller lacks explicit 404 handling', async () => {
      req.params = { id: 2 };
      const error = new Error('Not found');
      error.name = 'UserNotFoundError';
      userAdminService.getUserById.mockRejectedValue(error);

      await userController.getUserById(req, res);

      expect(mockHttp.sendServerError).toHaveBeenCalled();
    });
  });

  describe('updateUserById', () => {
    it('should update user', async () => {
      req.params = { id: 2 };
      req.body = { profile: { name: 'Admin' } };
      validateForm.mockReturnValue([true, null]);
      userAdminService.updateUserById.mockResolvedValue({ id: 2 });

      await userController.updateUserById(req, res);

      expect(userAdminService.updateUserById).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should prevent updating self', async () => {
      req.params = { id: 1 };

      await userController.updateUserById(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot update your own account',
        400,
      );
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update status and filter self', async () => {
      req.body = { ids: [1, 2, 3], state: 'active' };
      validateForm.mockReturnValue([true, null]);
      userAdminService.bulkUpdateStatus.mockResolvedValue({
        updated: 2,
        users: [{ id: 2 }, { id: 3 }],
      });

      await userController.bulkUpdateStatus(req, res);

      // Should filter out req.user.id (1)
      expect(userAdminService.bulkUpdateStatus).toHaveBeenCalledWith(
        [2, 3],
        true,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('bulkDelete', () => {
    it('should prevent deleting self', async () => {
      req.body = { ids: [1, 2] };
      validateForm.mockReturnValue([true, null]);

      await userController.bulkDelete(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot delete your own account',
        400,
      );
    });

    it('should bulk delete other users', async () => {
      req.body = { ids: [2, 3] };
      validateForm.mockReturnValue([true, null]);
      userAdminService.bulkDelete.mockResolvedValue({
        deleted: 2,
        deletedIds: [2, 3],
      });

      await userController.bulkDelete(req, res);

      expect(userAdminService.bulkDelete).toHaveBeenCalledWith(
        [2, 3],
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should use bulkDelete service internally', async () => {
      req.params = { id: 2 };
      userAdminService.bulkDelete.mockResolvedValue({ deleted: 1 });

      await userController.deleteUser(req, res);

      expect(userAdminService.bulkDelete).toHaveBeenCalledWith(
        [2],
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('exportUsers', () => {
    it('should fetch all users for export', async () => {
      req.query = { search: 'test' };
      userAdminService.getUserList.mockResolvedValue({
        users: [],
        pagination: { total: 0 },
      });

      await userController.exportUsers(req, res);

      expect(userAdminService.getUserList).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1000, search: 'test' }),
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('listApiKeys', () => {
    it('should return api keys', async () => {
      req.params = { id: 2 };
      userAdminService.listApiKeys.mockResolvedValue([]);

      await userController.listApiKeys(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('createApiKey', () => {
    it('should create an api key successfully', async () => {
      req.params = { id: 2 };
      req.body = { name: 'Key', scopes: [] };
      validateForm.mockReturnValue([true, null]);
      userAdminService.createApiKey.mockResolvedValue({ key: 'abc' });

      await userController.createApiKey(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('revokeApiKey', () => {
    it('should return 404 if not found', async () => {
      req.params = { id: 2, keyId: '3' };
      const error = new Error('Not found');
      error.name = 'ApiKeyNotFoundError';
      userAdminService.revokeApiKey.mockRejectedValue(error);

      await userController.revokeApiKey(req, res);

      expect(mockHttp.sendNotFound).toHaveBeenCalled();
    });
  });
});
