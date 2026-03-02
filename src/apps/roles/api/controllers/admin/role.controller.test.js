import { validateForm } from '../../../../../shared/validator';
import * as roleService from '../../services/admin/role.service';
import * as roleController from './role.controller';

jest.mock('../../../../../shared/validator', () => ({
  validateForm: jest.fn(),
}));

jest.mock('../../../validator/admin', () => ({
  createRoleFormSchema: jest.fn(() => ({})),
  updateRoleFormSchema: jest.fn(() => ({})),
}));

jest.mock('../../services/admin/role.service', () => ({
  createRole: jest.fn(),
  getRoles: jest.fn(),
  getRoleById: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  getUsersWithRole: jest.fn(),
  getGroupsWithRole: jest.fn(),
}));

describe('Admin Role Controller', () => {
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
      SYSTEM_ROLES: ['admin'],
      ADMIN_ROLE: 'admin',
      DEFAULT_ROLE: 'user',
      MODERATOR_ROLE: 'moderator',
      ADMIN_GROUP: 'admins',
      DEFAULT_GROUP: 'users',
    };

    req = {
      user: { id: 1, roles: ['manager'] },
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

  describe('createRole', () => {
    it('should validate and create role successfully', async () => {
      req.body = { name: 'admin-role' };
      validateForm.mockReturnValue([true, null]);
      roleService.createRole.mockResolvedValue({ id: 2, name: 'admin-role' });

      await roleController.createRole(req, res);

      expect(roleService.createRole).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(
        res,
        { role: { id: 2, name: 'admin-role' } },
        201,
      );
    });

    it('should return 409 if role already exists', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Already exists');
      error.name = 'RoleAlreadyExistsError';
      roleService.createRole.mockRejectedValue(error);

      await roleController.createRole(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 409);
    });

    it('should handle PermissionNotFoundError', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Missing perm');
      error.name = 'PermissionNotFoundError';
      roleService.createRole.mockRejectedValue(error);

      await roleController.createRole(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        permissions: error.message,
      });
    });
  });

  describe('getRoles', () => {
    it('should parse pagination and get list', async () => {
      roleService.getRoles.mockResolvedValue({ roles: [], pagination: {} });

      await roleController.getRoles(req, res);

      expect(roleService.getRoles).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getRoleById', () => {
    it('should find and return role', async () => {
      req.params = { id: 2 };
      roleService.getRoleById.mockResolvedValue({ id: 2 });

      await roleController.getRoleById(req, res);

      expect(roleService.getRoleById).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      req.params = { id: 2 };
      req.body = { name: 'new-name' };
      validateForm.mockReturnValue([true, null]);
      // The controller fetches the role first to check if the user is a member
      roleService.getRoleById.mockResolvedValue({ name: 'other-role' });
      roleService.updateRole.mockResolvedValue({ id: 2, name: 'new-name' });

      await roleController.updateRole(req, res);

      expect(roleService.updateRole).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should prevent updating roles the user currently has', async () => {
      req.params = { id: 2 };
      validateForm.mockReturnValue([true, null]);
      roleService.getRoleById.mockResolvedValue({ name: 'manager' }); // Intersects with req.user.roles

      await roleController.updateRole(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot update a role you have',
        400,
      );
    });
  });

  describe('deleteRole', () => {
    it('should prevent deleting roles the user currently has', async () => {
      req.params = { id: 2 };
      roleService.getRoleById.mockResolvedValue({ name: 'manager' }); // Intersects with req.user.roles

      await roleController.deleteRole(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot delete a role you have',
        400,
      );
    });

    it('should delete other roles successfully', async () => {
      req.params = { id: 2 };
      roleService.getRoleById.mockResolvedValue({ name: 'other-role' });
      roleService.deleteRole.mockResolvedValue();

      await roleController.deleteRole(req, res);

      expect(roleService.deleteRole).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getRoleUsers', () => {
    it('should fetch users for role', async () => {
      req.params = { id: 2 };
      roleService.getUsersWithRole.mockResolvedValue({ users: [] });

      await roleController.getRoleUsers(req, res);

      expect(roleService.getUsersWithRole).toHaveBeenCalledWith(
        2,
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should handle RoleNotFoundError', async () => {
      req.params = { id: 2 };
      const error = new Error('Not found');
      error.name = 'RoleNotFoundError';
      roleService.getUsersWithRole.mockRejectedValue(error);

      await roleController.getRoleUsers(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 404);
    });
  });

  describe('getRoleGroups', () => {
    it('should fetch groups for role', async () => {
      req.params = { id: 2 };
      roleService.getGroupsWithRole.mockResolvedValue({ groups: [] });

      await roleController.getRoleGroups(req, res);

      expect(roleService.getGroupsWithRole).toHaveBeenCalledWith(
        2,
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should handle RoleNotFoundError', async () => {
      req.params = { id: 2 };
      const error = new Error('Not found');
      error.name = 'RoleNotFoundError';
      roleService.getGroupsWithRole.mockRejectedValue(error);

      await roleController.getRoleGroups(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 404);
    });
  });
});
