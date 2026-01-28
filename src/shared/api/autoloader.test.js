describe('shared/api/autoloader', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('validateCoreModules', () => {
    it('should not throw if all core modules are present', () => {
      const { validateCoreModules } = require('./autoloader');
      const paths = ['./users/api/index.js', './other/api/index.js'];
      // Default core module is 'users'
      expect(() => validateCoreModules(paths)).not.toThrow();
    });

    it('should throw if a core module is missing', () => {
      const { validateCoreModules } = require('./autoloader');
      const paths = ['./other/api/index.js'];
      // 'users' is always required
      expect(() => validateCoreModules(paths)).toThrow(
        /Missing required core module/,
      );
    });

    it('should respect custom core modules from env', () => {
      process.env.RSK_MODULE_DEFAULTS = 'custom';
      const { validateCoreModules } = require('./autoloader');

      const paths = ['./other/api/index.js'];
      expect(() => validateCoreModules(paths)).toThrow(
        /Missing required core module/,
      );

      const validPaths = ['./users/api/index.js', './custom/api/index.js'];
      expect(() => validateCoreModules(validPaths)).not.toThrow();
    });
  });

  describe('sortModules', () => {
    it('should place core modules first', () => {
      const { sortModules } = require('./autoloader');
      const paths = [
        './z_module/api/index.js',
        './users/api/index.js',
        './a_module/api/index.js',
      ];
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
      process.env.RSK_MODULE_DEFAULTS = 'z_module';
      const { sortModules } = require('./autoloader');
      const paths = [
        './z_module/api/index.js',
        './users/api/index.js',
        './a_module/api/index.js',
      ];
      const sorted = sortModules(paths);

      // Both 'users' and 'z_module' are core.
      // They should come before 'a_module'.
      // Between 'users' and 'z_module', alphabetical sort applies -> 'users' first.

      expect(sorted[0]).toContain('users');
      expect(sorted[1]).toContain('z_module');
      expect(sorted[2]).toContain('a_module');

      expect(sorted).toEqual([
        './users/api/index.js',
        './z_module/api/index.js',
        './a_module/api/index.js',
      ]);
    });
  });
});
