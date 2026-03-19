import * as permissionController from './permission.controller';

describe('Admin Permission Controller (SQLite E2E)', () => {
  let req, res, mockHttp, mockModels, mockAuth;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockModels = global.testDb.models;

    mockHttp = {
      sendSuccess: jest.fn(),
      sendError: jest.fn((res, err) => {
        console.log('HTTP ERRROR:', err);
      }),
      sendValidationError: jest.fn((res, err) => {
        console.log('HTTP VALIDATION ERRROR:', err);
      }),
      sendServerError: jest.fn((res, err) => {
        console.log('HTTP SERVER ERRROR:', err);
      }),
      sendNotFound: jest.fn((res, err) => {
        console.log('HTTP NOT FOUND ERRROR:', err);
      }),
      getPagination: jest.fn(() => ({ page: 1, limit: 10 })),
    };

    mockAuth = {
      DEFAULT_RESOURCES: { ALL: '*' },
      DEFAULT_ACTIONS: { MANAGE: '*' },
      SYSTEM_PERMISSIONS: ['system'],
    };

    req = {
      user: { id: 'test-admin-id' },
      body: {},
      params: {},
      query: {},
      app: {
        get: jest.fn(key => {
          const deps = {
            http: mockHttp,
            models: mockModels,
            auth: mockAuth,
          };
          if (key === 'container')
            return { resolve: name => deps[name], has: () => false };
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
      req.body = {
        resource: 'articles',
        action: 'read',
        description: 'Read articles',
      };

      await permissionController.createPermission(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const responsePayload = mockHttp.sendSuccess.mock.calls[0][1];
      expect(responsePayload.permission).toBeDefined();
      expect(responsePayload.permission.resource).toBe('articles');
    });

    it('should return 409 if permission already exists', async () => {
      await mockModels.Permission.create({
        resource: 'articles',
        action: 'write',
        description: 'Test write',
      });

      req.body = { resource: 'articles', action: 'write' };

      await permissionController.createPermission(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });
  });

  describe('getPermissions', () => {
    it('should return a list of permissions', async () => {
      await mockModels.Permission.create({
        resource: 'users',
        action: 'write',
      });

      await permissionController.getPermissions(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('getPermissionsByResource', () => {
    it('should get permissions correctly for a resource', async () => {
      await mockModels.Permission.create({
        resource: 'books',
        action: 'write',
      });

      req.params = { resource: 'books' };
      await permissionController.getPermissionsByResource(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.permissions[0].resource).toBe('books');
    });
  });

  describe('getPermissionById', () => {
    it('should find and return permission', async () => {
      const p = await mockModels.Permission.create({
        id: '123e4567-e89b-12d3-a456-426614174001',
        resource: 'cars',
        action: 'drive',
      });

      req.params = { id: p.id };
      await permissionController.getPermissionById(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.permission.id).toBe(p.id);
    });
  });

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      const p = await mockModels.Permission.create({
        id: '123e4567-e89b-12d3-a456-426614174002',
        resource: 'planes',
        action: 'fly',
      });

      req.params = { id: p.id };
      req.body = { resource: 'planes', action: 'land' };

      await permissionController.updatePermission(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();

      const dbCheck = await mockModels.Permission.findByPk(p.id);
      expect(dbCheck.action).toBe('land');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update permissions', async () => {
      const p1 = await mockModels.Permission.create({
        id: '123e4567-e89b-12d3-a456-426614174003',
        resource: 'x',
        action: 'y',
        is_active: false,
      });
      const p2 = await mockModels.Permission.create({
        id: '123e4567-e89b-12d3-a456-426614174004',
        resource: 'a',
        action: 'b',
        is_active: false,
      });

      req.body = { ids: [p1.id, p2.id], state: 'active' };

      await permissionController.bulkUpdateStatus(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const updated1 = await mockModels.Permission.findByPk(p1.id);
      const updated2 = await mockModels.Permission.findByPk(p2.id);
      expect(updated1.is_active).toBe(true);
      expect(updated2.is_active).toBe(true);
    });
  });

  describe('deletePermissions', () => {
    it('should delete permissions successfully', async () => {
      const p1 = await mockModels.Permission.create({
        id: '123e4567-e89b-12d3-a456-426614174005',
        resource: 'x',
        action: 'y',
      });

      req.body = { ids: [p1.id] };

      await permissionController.deletePermissions(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const count = await mockModels.Permission.count();
      expect(count).toBe(0);
    });
  });
});
