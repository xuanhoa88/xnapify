/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

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
      const { validateCoreModules } = require('./autoloader.js');
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
        'settings',
        'activities',
        'other',
      ].map(p => `./${p}/api/index.js`);
      // Default core module is 'users'
      expect(() => validateCoreModules(paths)).not.toThrow();
    });

    it('should throw if a core module is missing', () => {
      const { validateCoreModules } = require('./autoloader.js');
      const paths = ['other'].map(p => `./${p}/api/index.js`);
      // 'users' is always required
      expect(() => validateCoreModules(paths)).toThrow(
        /Missing required core module/,
      );
    });

    it('should respect custom core modules from env', () => {
      process.env.XNAPIFY_MODULE_DEFAULTS = 'custom';
      const { validateCoreModules } = require('./autoloader.js');

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
        'settings',
        'activities',
        'custom',
      ].map(p => `./${p}/api/index.js`);
      expect(() => validateCoreModules(validPaths)).not.toThrow();
    });
  });

  describe('sortModules', () => {
    it('should place core modules first', () => {
      const { sortModules } = require('./autoloader.js');
      const paths = ['z_module', 'users', 'a_module'].map(
        p => `./${p}/api/index.js`,
      );
      const sorted = sortModules(paths);
      expect(sorted[0]).toContain('users');
      expect(sorted).toHaveLength(3);
    });

    it('should sort lifecycle files correctly', () => {
      const { sortModules } = require('./autoloader.js');
      const paths = ['./z_module/api/index.js', './users/api/index.js'];
      const sorted = sortModules(paths);
      expect(sorted[0]).toContain('users'); // users is core
      expect(sorted[1]).toContain('z_module');
    });

    it('should sort based on custom core modules', () => {
      process.env.XNAPIFY_MODULE_DEFAULTS = 'z_module';
      const { sortModules } = require('./autoloader.js');
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
    let mockDb;
    let mockContainer;

    beforeEach(() => {
      mockDb = { isMock: true };
      mockContainer = {
        resolve: jest.fn(key => {
          if (key === 'db') return mockDb;
          return null;
        }),
        has: jest.fn(key => key === 'db'),
        instance: jest.fn(),
      };
    });

    it('should load translations via hooks.translations()', async () => {
      const { discoverModules } = require('./autoloader.js');
      const { getTranslations } = require('@shared/i18n/loader.js');
      const { addNamespace } = require('@shared/i18n/utils.js');

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
            'settings',
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
      const { discoverModules } = require('./autoloader.js');

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
            'settings',
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
          return { default: jest.fn().mockReturnValue(userModel) };
        }
        if (key === './Post.js') {
          return { default: jest.fn().mockReturnValue(postModel) };
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
            'settings',
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
      expect(apiModels.User).toEqual(userModel);
      expect(apiModels.Post).toEqual(postModel);

      // Verify associations called
      expect(userModel.associate).toHaveBeenCalledWith(apiModels);
      expect(postModel.associate).toHaveBeenCalledWith(apiModels);

      // Verify boot was called
      expect(usersInit).toHaveBeenCalled();
    });

    it('should skip modules without models hook', async () => {
      const { discoverModules } = require('./autoloader.js');

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
            'settings',
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
        return { default: jest.fn().mockReturnValue(userModel) };
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
            'settings',
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

      expect(apiModels.User).toBeDefined();
      expect(apiModels.size).toBe(1);
    });

    it('refuses to boot when any module\u2019s migrations fail', async () => {
      // Regression: a failed migration phase in a non-core module was one log
      // line, and the caller discarded `errors`, so a worker went on to serve
      // traffic against a half-migrated schema.
      const { discoverModules } = require('./autoloader.js');

      const CORE = [
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
        'settings',
        'activities',
      ];

      const mockContext = jest.fn();
      mockContext.keys = jest
        .fn()
        .mockReturnValue([...CORE, 'reports'].map(p => `./${p}/api/index.js`));

      const bootedAfterMigrations = jest.fn();
      const migrationsContext = jest.fn();

      mockContext.mockImplementation(key => {
        if (key === './reports/api/index.js') {
          // 'reports' is NOT a core module — the old code only logged this.
          return {
            migrations: () => migrationsContext,
            boot: bootedAfterMigrations,
          };
        }
        return { boot: jest.fn() };
      });

      const db = {
        connection: {
          runMigrations: jest.fn(async () => {
            throw new Error('SQLITE_BUSY: database is locked');
          }),
        },
      };
      const container = {
        resolve: jest.fn(key => (key === 'db' ? db : null)),
        has: jest.fn(key => key === 'db'),
        instance: jest.fn(),
      };

      await expect(
        discoverModules(mockContext, container),
      ).rejects.toMatchObject({ code: 'MIGRATION_PHASE_FAILED' });
      expect(db.connection.runMigrations).toHaveBeenCalled();
      // Boot must not have run: nothing may serve on a half-migrated schema.
      expect(bootedAfterMigrations).not.toHaveBeenCalled();
    });
  });
});
