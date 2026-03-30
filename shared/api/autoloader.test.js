jest.mock('@shared/i18n/loader', () => ({
  getTranslations: jest.fn(),
}));

jest.mock('@shared/i18n/utils', () => ({
  addNamespace: jest.fn(),
}));

describe('shared/api/autoloader', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('validateCoreModules', () => {
    it('should not throw if all core modules are present', () => {
      const { validateCoreModules } = require('./autoloader');
      const paths = [
        'users',
        'roles',
        'groups',
        'permissions',
        'auth',
        'files',
        'extensions',
        'emails',
        'webhooks',
        'search',
        'activities',
        'other',
      ].map(p => `./${p}/api/index.js`);
      // Default core module is 'users'
      expect(() => validateCoreModules(paths)).not.toThrow();
    });

    it('should throw if a core module is missing', () => {
      const { validateCoreModules } = require('./autoloader');
      const paths = ['other'].map(p => `./${p}/api/index.js`);
      // 'users' is always required
      expect(() => validateCoreModules(paths)).toThrow(
        /Missing required core module/,
      );
    });

    it('should respect custom core modules from env', () => {
      process.env.XNAPIFY_MODULE_DEFAULTS = 'custom';
      const { validateCoreModules } = require('./autoloader');

      const paths = ['other'].map(p => `./${p}/api/index.js`);
      expect(() => validateCoreModules(paths)).toThrow(
        /Missing required core module/,
      );

      const validPaths = [
        'users',
        'roles',
        'groups',
        'permissions',
        'auth',
        'files',
        'extensions',
        'emails',
        'webhooks',
        'search',
        'activities',
        'custom',
      ].map(p => `./${p}/api/index.js`);
      expect(() => validateCoreModules(validPaths)).not.toThrow();
    });
  });

  describe('sortModules', () => {
    it('should place core modules first', () => {
      const { sortModules } = require('./autoloader');
      const paths = ['z_module', 'users', 'a_module'].map(
        p => `./${p}/api/index.js`,
      );
      const sorted = sortModules(paths);
      expect(sorted[0]).toContain('users');
      expect(sorted).toHaveLength(3);
    });

    it('should sort lifecycle files correctly', () => {
      const { sortModules } = require('./autoloader');
      const paths = ['./z_module/api/index.js', './users/api/index.js'];
      const sorted = sortModules(paths);
      expect(sorted[0]).toContain('users'); // users is core
      expect(sorted[1]).toContain('z_module');
    });

    it('should sort based on custom core modules', () => {
      process.env.XNAPIFY_MODULE_DEFAULTS = 'z_module';
      const { sortModules } = require('./autoloader');
      const paths = ['users', 'z_module', 'a_module'].map(
        p => `./${p}/api/index.js`,
      );
      const sorted = sortModules(paths);

      // Both 'users' and 'z_module' are core.
      // They should come before 'a_module'.
      // Between 'users' and 'z_module', alphabetical sort applies -> 'users' first.

      expect(sorted[0]).toContain('users');
      expect(sorted[1]).toContain('z_module');
      expect(sorted[2]).toContain('a_module');

      expect(sorted).toEqual(
        ['users', 'z_module', 'a_module'].map(p => `./${p}/api/index.js`),
      );
    });
  });

  describe('discoverModules', () => {
    const mockDb = {};
    const mockContainer = {
      resolve: jest.fn(key => {
        if (key === 'db') return mockDb;
        return null;
      }),
      has: jest.fn(key => key === 'db'),
      instance: jest.fn(),
    };

    beforeEach(() => {
      mockContainer.resolve.mockClear();
      mockContainer.has.mockClear();
      mockContainer.instance.mockClear();
    });

    it('should load translations via hooks.translations()', async () => {
      const { discoverModules } = require('./autoloader');
      const { getTranslations } = require('@shared/i18n/loader');
      const { addNamespace } = require('@shared/i18n/utils');

      // Setup translations mocks
      getTranslations.mockReturnValue({ 'en-US': { hello: 'world' } });

      const mockContext = jest.fn();
      mockContext.keys = jest
        .fn()
        .mockReturnValue(
          [
            'users',
            'roles',
            'groups',
            'permissions',
            'auth',
            'files',
            'extensions',
            'emails',
            'webhooks',
            'search',
            'activities',
          ].map(p => `./${p}/api/index.js`),
        );

      const mockTranslationsContext = jest.fn();

      mockContext.mockImplementation(key => {
        if (key === './users/api/index.js') {
          return {
            translations: () => mockTranslationsContext,
            boot: jest.fn(),
            routes: jest.fn(),
          };
        }
        return { boot: jest.fn() };
      });

      await discoverModules(mockContext, mockContainer);

      expect(getTranslations).toHaveBeenCalledWith(mockTranslationsContext);
      expect(addNamespace).toHaveBeenCalledWith('users', {
        'en-US': { hello: 'world' },
      });
    });

    it('should load models via hooks.models() and call boot', async () => {
      const { discoverModules } = require('./autoloader');

      // Mock context — only lifecycle files now (no model paths)
      const mockContext = jest.fn();
      mockContext.keys = jest
        .fn()
        .mockReturnValue(
          [
            'users',
            'roles',
            'groups',
            'permissions',
            'auth',
            'files',
            'extensions',
            'emails',
            'webhooks',
            'search',
            'activities',
          ].map(p => `./${p}/api/index.js`),
        );

      // Mock model context returned by hooks.models()
      const userModel = {
        name: 'User',
        associate: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
      };
      const postModel = {
        name: 'Post',
        associate: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
      };

      const mockModelContext = jest.fn();
      mockModelContext.keys = jest
        .fn()
        .mockReturnValue(['./User.js', './Post.js']);
      mockModelContext.mockImplementation(key => {
        if (key === './User.js') {
          return { default: jest.fn().mockResolvedValue(userModel) };
        }
        if (key === './Post.js') {
          return { default: jest.fn().mockResolvedValue(postModel) };
        }
      });

      const usersInit = jest.fn();

      mockContext.mockImplementation(key => {
        if (key === './users/api/index.js') {
          return {
            boot: usersInit,
            models: () => mockModelContext,
            routes: jest.fn(),
          };
        }
        if (key === './extensions/api/index.js') {
          return { boot: jest.fn() };
        }
        if (
          [
            'roles',
            'groups',
            'permissions',
            'auth',
            'files',
            'emails',
            'webhooks',
            'search',
            'activities',
          ]
            .map(p => `./${p}/api/index.js`)
            .includes(key)
        ) {
          return { boot: jest.fn() };
        }
      });

      const { apiModels } = await discoverModules(mockContext, mockContainer);

      // Verify models loaded via hooks.models()
      expect(apiModels).toHaveProperty('User', userModel);
      expect(apiModels).toHaveProperty('Post', postModel);

      // Verify associations called
      expect(userModel.associate).toHaveBeenCalledWith(apiModels);
      expect(postModel.associate).toHaveBeenCalledWith(apiModels);

      // Verify boot was called
      expect(usersInit).toHaveBeenCalled();
    });

    it('should skip modules without models hook', async () => {
      const { discoverModules } = require('./autoloader');

      const mockContext = jest.fn();
      mockContext.keys = jest
        .fn()
        .mockReturnValue(
          [
            'users',
            'roles',
            'groups',
            'permissions',
            'auth',
            'files',
            'extensions',
            'emails',
            'webhooks',
            'search',
            'activities',
          ].map(p => `./${p}/api/index.js`),
        );

      // Only users exports models()
      const userModel = {
        name: 'User',
        associate: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
      };

      const mockModelContext = jest.fn();
      mockModelContext.keys = jest.fn().mockReturnValue(['./User.js']);
      mockModelContext.mockImplementation(() => {
        return { default: jest.fn().mockResolvedValue(userModel) };
      });

      mockContext.mockImplementation(key => {
        if (key === './users/api/index.js') {
          return {
            boot: jest.fn(),
            models: () => mockModelContext,
          };
        }
        if (key === './extensions/api/index.js') return { boot: jest.fn() };
        if (
          [
            'roles',
            'groups',
            'permissions',
            'auth',
            'files',
            'emails',
            'webhooks',
            'search',
            'activities',
          ]
            .map(p => `./${p}/api/index.js`)
            .includes(key)
        ) {
          return { boot: jest.fn() };
        }
        return { default: jest.fn() };
      });

      const { apiModels } = await discoverModules(mockContext, mockContainer);

      expect(apiModels).toHaveProperty('User');
      expect(Object.keys(apiModels)).toHaveLength(1);
    });
  });
});
