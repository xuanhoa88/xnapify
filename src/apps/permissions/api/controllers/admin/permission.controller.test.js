import { validateForm } from '../../../../../shared/validator';
import * as permissionService from '../../services/admin/permission.service';
import * as permissionController from './permission.controller';

jest.mock('../../../../../shared/validator', () => ({
  validateForm: jest.fn(),
}));

jest.mock('../../../validator/admin', () => ({
  createPermissionFormSchema: jest.fn(() => ({})),
  updatePermissionFormSchema: jest.fn(() => ({})),
  bulkUpdatePermissionStatusFormSchema: jest.fn(() => ({})),
  bulkDeletePermissionFormSchema: jest.fn(() => ({})),
}));

jest.mock('../../services/admin/permission.service', () => ({
  createPermission: jest.fn(),
  getPermissions: jest.fn(),
  getPermissionsByResource: jest.fn(),
  getPermissionById: jest.fn(),
  updatePermission: jest.fn(),
  bulkUpdateStatus: jest.fn(),
  bulkDelete: jest.fn(),
}));

describe('Admin Permission Controller', () => {
  let req;
  let res;
  let mockHttp;
  let mockModels;
  let mockWebhook;
  let mockAuth;

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
    mockWebhook = {};
    mockAuth = {
      DEFAULT_RESOURCES: {},
      DEFAULT_ACTIONS: {},
      SYSTEM_PERMISSIONS: ['admin'],
    };

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
            webhook: mockWebhook,
            auth: mockAuth,
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

  describe('createPermission', () => {
    it('should validate and create permission successfully', async () => {
      req.body = { resource: 'users', action: 'read' };
      validateForm.mockReturnValue([true, null]);
      permissionService.createPermission.mockResolvedValue({
        id: 2,
        resource: 'users',
      });

      await permissionController.createPermission(req, res);

      expect(permissionService.createPermission).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(
        res,
        { permission: { id: 2, resource: 'users' } },
        201,
      );
    });

    it('should return 409 if permission already exists', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Already exists');
      error.name = 'PermissionAlreadyExistsError';
      permissionService.createPermission.mockRejectedValue(error);

      await permissionController.createPermission(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 409);
    });
  });

  describe('getPermissions', () => {
    it('should parse pagination and get permissions', async () => {
      permissionService.getPermissions.mockResolvedValue({
        permissions: [],
        pagination: {},
      });

      await permissionController.getPermissions(req, res);

      expect(permissionService.getPermissions).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPermissionsByResource', () => {
    it('should parse pagination and get permissions by resource', async () => {
      req.params = { resource: 'users' };
      permissionService.getPermissionsByResource.mockResolvedValue({
        permissions: [],
        pagination: {},
      });

      await permissionController.getPermissionsByResource(req, res);

      expect(permissionService.getPermissionsByResource).toHaveBeenCalledWith(
        'users',
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPermissionById', () => {
    it('should find and return permission', async () => {
      req.params = { id: 2 };
      permissionService.getPermissionById.mockResolvedValue({ id: 2 });

      await permissionController.getPermissionById(req, res);

      expect(permissionService.getPermissionById).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      req.params = { id: 2 };
      req.body = { resource: 'articles' };
      validateForm.mockReturnValue([true, null]);
      permissionService.updatePermission.mockResolvedValue({
        id: 2,
        resource: 'articles',
      });

      await permissionController.updatePermission(req, res);

      expect(permissionService.updatePermission).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should handle PermissionAlreadyExistsError', async () => {
      req.params = { id: 2 };
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Already exists');
      error.name = 'PermissionAlreadyExistsError';
      permissionService.updatePermission.mockRejectedValue(error);

      await permissionController.updatePermission(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 409);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update permissions', async () => {
      req.body = { ids: [1, 2], state: 'active' };
      validateForm.mockReturnValue([true, null]);
      permissionService.bulkUpdateStatus.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      await permissionController.bulkUpdateStatus(req, res);

      expect(permissionService.bulkUpdateStatus).toHaveBeenCalledWith(
        [1, 2],
        true,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('deletePermissions', () => {
    it('should delete permissions successfully', async () => {
      req.body = { ids: [1, 2] };
      validateForm.mockReturnValue([true, null]);
      permissionService.bulkDelete.mockResolvedValue({
        deleted: 2,
        deletedIds: [1, 2],
        protectedIds: [],
      });

      await permissionController.deletePermissions(req, res);

      expect(permissionService.bulkDelete).toHaveBeenCalledWith(
        [1, 2],
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });
});
