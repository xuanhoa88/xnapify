import * as roleController from './role.controller';

describe('Admin Role Controller (SQLite E2E)', () => {
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
      getPagination: jest.fn(() => ({ page: 1, limit: 10 })),
    };

    mockAuth = {
      DEFAULT_RESOURCES: { ALL: '*' },
      DEFAULT_ACTIONS: { MANAGE: '*' },
      SYSTEM_ROLES: ['admin'],
      ADMIN_ROLE: 'admin',
      DEFAULT_ROLE: 'user',
      MODERATOR_ROLE: 'moderator',
      ADMIN_GROUP: 'admins',
      DEFAULT_GROUP: 'users',
    };

    req = {
      user: { id: 'test-admin-id', roles: ['manager'] },
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
      req.body = { name: 'new-role' };

      await roleController.createRole(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const responsePayload = mockHttp.sendSuccess.mock.calls[0][1];
      expect(responsePayload.role).toBeDefined();
      expect(responsePayload.role.name).toBe('new-role');
    });

    it('should return 409 if role already exists', async () => {
      await mockModels.Role.create({ name: 'existing-role' });
      req.body = { name: 'existing-role' };

      await roleController.createRole(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });

    it('should handle invalid payload validation errors', async () => {
      req.body = { name: 'new-role', permissions: 'not-an-array' };

      await roleController.createRole(req, res);

      expect(mockHttp.sendValidationError).toHaveBeenCalledWith(
        res,
        expect.any(Object),
      );
    });
  });

  describe('getRoles', () => {
    it('should parse pagination and get list', async () => {
      await mockModels.Role.create({ name: 'role-a' });

      await roleController.getRoles(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.roles.length).toBeGreaterThan(0);
    });
  });

  describe('getRoleById', () => {
    it('should find and return role', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174010',
        name: 'role-b',
      });

      req.params = { id: r.id };
      await roleController.getRoleById(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(result.role.id).toBe(r.id);
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174011',
        name: 'other-role',
      });

      req.params = { id: r.id };
      req.body = { name: 'new-name' };

      await roleController.updateRole(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const dbCheck = await mockModels.Role.findByPk(r.id);
      expect(dbCheck.name).toBe('new-name');
    });

    it('should prevent updating roles the user currently has', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174012',
        name: 'manager', // req.user.roles is ['manager']
      });

      req.params = { id: r.id };
      req.body = { name: 'manager-new' };

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
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174013',
        name: 'manager',
      });

      req.params = { id: r.id };

      await roleController.deleteRole(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        'Cannot delete a role you have',
        400,
      );
    });

    it('should delete other roles successfully', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174014',
        name: 'other-role',
      });

      req.params = { id: r.id };

      await roleController.deleteRole(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const count = await mockModels.Role.count();
      expect(count).toBe(0);
    });
  });

  describe('getRoleUsers', () => {
    it('should fetch users for role', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174015',
        name: 'role-c',
      });

      req.params = { id: r.id };

      await roleController.getRoleUsers(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(Array.isArray(result.users)).toBe(true);
    });

    it('should handle RoleNotFoundError', async () => {
      req.params = { id: '123e4567-e89b-12d3-a456-426614174999' }; // Non-existent

      await roleController.getRoleUsers(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        expect.any(String),
        404,
      );
    });
  });

  describe('getRoleGroups', () => {
    it('should fetch groups for role', async () => {
      const r = await mockModels.Role.create({
        id: '123e4567-e89b-12d3-a456-426614174016',
        name: 'role-d',
      });

      req.params = { id: r.id };

      await roleController.getRoleGroups(req, res);

      expect(mockHttp.sendSuccess).toHaveBeenCalled();
      const result = mockHttp.sendSuccess.mock.calls[0][1];
      expect(Array.isArray(result.groups)).toBe(true);
    });

    it('should handle RoleNotFoundError', async () => {
      req.params = { id: '123e4567-e89b-12d3-a456-426614174998' };

      await roleController.getRoleGroups(req, res);

      expect(mockHttp.sendError).toHaveBeenCalledWith(
        res,
        expect.any(String),
        404,
      );
    });
  });
});
