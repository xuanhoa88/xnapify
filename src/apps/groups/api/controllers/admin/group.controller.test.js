import { validateForm } from '../../../../../shared/validator';
import * as groupService from '../../services/admin/group.service';
import * as groupController from './group.controller';

jest.mock('../../../../../shared/validator', () => ({
  validateForm: jest.fn(),
}));

jest.mock('../../../validator/admin', () => ({
  createGroupFormSchema: jest.fn(() => ({})),
  updateGroupFormSchema: jest.fn(() => ({})),
}));

jest.mock('../../services/admin/group.service', () => ({
  createGroup: jest.fn(),
  getGroups: jest.fn(),
  getGroupById: jest.fn(),
  updateGroupById: jest.fn(),
  deleteGroup: jest.fn(),
  getUsersWithGroup: jest.fn(),
}));

describe('Admin Group Controller', () => {
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
      getPagination: jest.fn(() => ({ page: 1, limit: 10, offset: 0 })),
    };

    mockModels = {};
    mockWebhook = {};
    mockAuth = { DEFAULT_ROLE: 'user', SYSTEM_GROUPS: ['admin'] };

    req = {
      user: { id: 1, groups: ['group-a'] },
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

  describe('createGroup', () => {
    it('should validate and create group successfully', async () => {
      req.body = { name: 'admin-group' };
      validateForm.mockReturnValue([true, null]);
      groupService.createGroup.mockResolvedValue({
        id: 2,
        name: 'admin-group',
      });

      await groupController.createGroup(req, res);

      expect(groupService.createGroup).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalledWith(
        res,
        { group: { id: 2, name: 'admin-group' } },
        201,
      );
    });

    it('should return 409 if group already exists', async () => {
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Already exists');
      error.name = 'GroupAlreadyExistsError';
      groupService.createGroup.mockRejectedValue(error);

      await groupController.createGroup(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 409);
    });

    it('should return validation error if input is invalid', async () => {
      validateForm.mockReturnValue([false, { name: 'Required' }]);

      await groupController.createGroup(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(res, {
        name: 'Required',
      });
    });
  });

  describe('getGroups', () => {
    it('should parse pagination and get list', async () => {
      groupService.getGroups.mockResolvedValue({ groups: [], pagination: {} });

      await groupController.getGroups(req, res);

      expect(groupService.getGroups).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getGroupById', () => {
    it('should find and return group', async () => {
      req.params = { id: 2 };
      groupService.getGroupById.mockResolvedValue({ id: 2 });

      await groupController.getGroupById(req, res);

      expect(groupService.getGroupById).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 2 };
      groupService.getGroupById.mockResolvedValue(null);

      await groupController.getGroupById(req, res);

      expect(mockHttp.sendNotFound).toHaveBeenCalled();
    });
  });

  describe('updateGroupById', () => {
    it('should update group successfully', async () => {
      req.params = { id: 'some-other-group' };
      req.body = { name: 'new-name' };
      validateForm.mockReturnValue([true, null]);
      groupService.updateGroupById.mockResolvedValue({
        id: 'some-other-group',
      });

      await groupController.updateGroupById(req, res);

      expect(groupService.updateGroupById).toHaveBeenCalled();
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });

    it('should prevent updating groups the user belongs to', async () => {
      req.params = { id: 'group-a' }; // current user is in group-a

      await groupController.updateGroupById(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot update a group you belong to',
        400,
      );
    });

    it('should handle GroupAlreadyExistsError', async () => {
      req.params = { id: 'some-other-group' };
      validateForm.mockReturnValue([true, null]);
      const error = new Error('Exists');
      error.name = 'GroupAlreadyExistsError';
      groupService.updateGroupById.mockRejectedValue(error);

      await groupController.updateGroupById(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(res, error.message, 409);
    });
  });

  describe('deleteGroup', () => {
    it('should prevent deleting groups the user belongs to', async () => {
      req.params = { id: 'group-a' }; // current user is in group-a

      await groupController.deleteGroup(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot delete a group you belong to',
        400,
      );
    });

    it('should bulk delete other groups', async () => {
      req.params = { id: 'group-b' };
      groupService.deleteGroup.mockResolvedValue();

      await groupController.deleteGroup(req, res);

      expect(groupService.deleteGroup).toHaveBeenCalledWith(
        'group-b',
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getGroupUsers', () => {
    it('should fetch users for group', async () => {
      req.params = { id: 'group-b' };
      groupService.getUsersWithGroup.mockResolvedValue({ users: [] });

      await groupController.getGroupUsers(req, res);

      expect(groupService.getUsersWithGroup).toHaveBeenCalledWith(
        'group-b',
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockHttp.sendSuccess).toHaveBeenCalled();
    });
  });
});
