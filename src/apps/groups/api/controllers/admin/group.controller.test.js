import * as groupController from './group.controller';

describe('Admin Group Controller (SQLite E2E)', () => {
  let req, res, mockHttp, mockModels, mockAuth;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockModels = global.testDb.models;

    mockHttp = {
      sendSuccess: jest.fn(),
      sendError: jest.fn((res, err) => {
        console.log('HTTP ERROR:', err);
      }),
      sendValidationError: jest.fn((res, err) => {
        console.log('HTTP VALIDATION ERROR:', err);
      }),
      sendServerError: jest.fn((res, err) => {
        console.log('HTTP SERVER ERROR:', err);
      }),
      sendNotFound: jest.fn((res, err) => {
        console.log('HTTP NOT FOUND ERROR:', err);
      }),
      getPagination: jest.fn(() => ({ page: 1, limit: 10, offset: 0 })),
    };

    mockAuth = { DEFAULT_ROLE: 'user', SYSTEM_GROUPS: ['admin'] };

    req = {
      user: { id: 'test-admin-id', groups: [] },
      body: {},
      params: {},
      query: {},
      app: {
        get: jest.fn(key => {
          const deps = {
            http: mockHttp,
            models: mockModels,
            auth: mockAuth,
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

  describe('createGroup', () => {
    it('should validate and create group successfully', async () => {
      req.body = { name: 'admin-group' };

      await groupController.createGroup(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const responsePayload = mockHttp.sendSuccess.mock.calls[0][1];
      expect(responsePayload.group).toBeDefined();
      expect(responsePayload.group.name).toBe('admin-group');
    });

    it('should return 409 if group already exists', async () => {
      await mockModels.Group.create({ name: 'existing-group' });
      req.body = { name: 'existing-group' };

      await groupController.createGroup(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });

    it('should return validation error if input is invalid', async () => {
      req.body = { name: '' }; // Empty name

      await groupController.createGroup(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });
  });

  describe('getGroups', () => {
    it('should parse pagination and get list', async () => {
      await mockModels.Group.create({ name: 'group-a' });

      await groupController.getGroups(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.groups.length).toBeGreaterThan(0);
    });
  });

  describe('getGroupById', () => {
    it('should find and return group', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'group-b',
      });

      req.params = { id: g.id };
      await groupController.getGroupById(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.group.id).toBe(g.id);
    });

    it('should return 404 if not found', async () => {
      req.params = { id: '123e4567-e89b-12d3-a456-426614174999' };

      await groupController.getGroupById(req, res);

      expect(mockHttp.sendNotFound).toHaveBeenCalled();
    });
  });

  describe('updateGroupById', () => {
    it('should update group successfully', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'some-other-group',
      });

      req.params = { id: g.id };
      req.body = { name: 'new-name' };

      await groupController.updateGroupById(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const dbCheck = await mockModels.Group.findByPk(g.id);
      expect(dbCheck.name).toBe('new-name');
    });

    it('should prevent updating groups the user belongs to', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: 'group-a',
      });
      req.user.groups = [g.id];
      req.params = { id: g.id };
      req.body = { name: 'manager-new' };

      await groupController.updateGroupById(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot update a group you belong to',
        400,
      );
    });

    it('should handle GroupAlreadyExistsError', async () => {
      await mockModels.Group.create({ name: 'existing-group' });
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174004',
        name: 'target-group',
      });

      req.params = { id: g.id };
      req.body = { name: 'existing-group' };

      await groupController.updateGroupById(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });
  });

  describe('deleteGroup', () => {
    it('should prevent deleting groups the user belongs to', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174005',
        name: 'group-a',
      });
      req.user.groups = [g.id];
      req.params = { id: g.id };

      await groupController.deleteGroup(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot delete a group you belong to',
        400,
      );
    });

    it('should delete other groups successfully', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174006',
        name: 'group-b',
      });

      req.params = { id: g.id };

      await groupController.deleteGroup(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const count = await mockModels.Group.count();
      expect(count).toBe(0);
    });
  });

  describe('getGroupUsers', () => {
    it('should fetch users for group', async () => {
      const g = await mockModels.Group.create({
        id: '123e4567-e89b-12d3-a456-426614174007',
        name: 'group-b',
      });

      req.params = { id: g.id };

      await groupController.getGroupUsers(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(Array.isArray(result.users)).toBe(true);
    });
  });
});
