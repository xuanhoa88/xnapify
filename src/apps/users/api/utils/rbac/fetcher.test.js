import { getUserRbacData } from './fetcher';

// Mock dependencies
jest.mock('./cache', () => ({
  getUser: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('./collector', () => ({
  collectUserRbacData: jest.fn(user => ({
    roles: user.roles ? user.roles.map(r => r.name) : [],
    groups: user.groups ? user.groups.map(g => g.name) : [],
    permissions: [],
  })),
}));

describe('RBAC Fetcher', () => {
  let req;
  let modelsMock;
  let cacheMock;

  beforeEach(() => {
    cacheMock = {};
    modelsMock = {
      User: { findByPk: jest.fn() },
      Role: {},
      Group: {},
      Permission: {},
    };

    req = {
      app: {
        get: jest.fn(key => {
          if (key === 'container')
            return {
              resolve: name => {
                if (name === 'models') return modelsMock;
                if (name === 'cache') return cacheMock;
                return null;
              },
            };
          return null;
        }),
      },
      user: { id: 'user-123' },
    };

    jest.clearAllMocks();
  });

  describe('getUserRbacData', () => {
    it('should fetch data from DB for standard user', async () => {
      const mockUser = {
        id: 'user-123',
        roles: [{ name: 'admin' }],
        groups: [],
      };
      modelsMock.User.findByPk.mockResolvedValue(mockUser);

      const result = await getUserRbacData(req);

      expect(modelsMock.User.findByPk).toHaveBeenCalled();
      expect(result.roles).toContain('admin');
      expect(req.user.roles).toContain('admin');
    });

    it('should use API key scopes when authMethod is api_key', async () => {
      req.authMethod = 'api_key';
      req.apiKey = {
        scopes: ['users:read', 'users:write'],
      };
      // Ensure DB is NOT called
      modelsMock.User.findByPk.mockRejectedValue(
        new Error('Should not call DB'),
      );

      const result = await getUserRbacData(req);

      expect(modelsMock.User.findByPk).not.toHaveBeenCalled();
      expect(result).toEqual({
        roles: [],
        groups: [],
        permissions: ['users:read', 'users:write'],
      });
      expect(req.user.permissions).toEqual(['users:read', 'users:write']);
    });

    it('should default to empty permissions for API key with no scopes', async () => {
      req.authMethod = 'api_key';
      req.apiKey = {
        scopes: null, // or undefined
      };

      const result = await getUserRbacData(req);

      expect(result.permissions).toEqual([]);
    });
  });
});
