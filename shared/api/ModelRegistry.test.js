/**
 * ModelRegistry — Test Suite
 *
 * Covers: registration, sealing, discovery (idempotency, error paths),
 * associations, unregistration, Proxy-based access, and edge cases.
 */

import ModelRegistry from './ModelRegistry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@shared/utils/contextAdapter', () => ({
  createWebpackContextAdapter: jest.fn(),
}));

const {
  createWebpackContextAdapter,
} = require('@shared/utils/contextAdapter');

// Helpers
function createMockDb() {
  return { connection: {}, DataTypes: {} };
}

function createMockModel(name, opts = {}) {
  return { name, ...opts };
}

function createMockAdapter(fileMap) {
  return {
    files: () => Object.keys(fileMap),
    load: key => fileMap[key],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelRegistry', () => {
  let registry;
  let db;

  beforeEach(() => {
    db = createMockDb();
    registry = new ModelRegistry(db);
    jest.clearAllMocks();
  });

  // =========================================================================
  // Construction
  // =========================================================================

  describe('constructor', () => {
    it('should create an empty registry', () => {
      expect(registry.size).toBe(0);
      expect(registry.names()).toEqual([]);
    });

    it('should accept null db parameter', () => {
      const r = new ModelRegistry(null);
      expect(r.size).toBe(0);
    });

    it('should accept no db parameter', () => {
      const r = new ModelRegistry();
      expect(r.size).toBe(0);
    });
  });

  // =========================================================================
  // Registration
  // =========================================================================

  describe('register()', () => {
    it('should register a model', () => {
      const model = createMockModel('User');
      registry.register('User', model);

      expect(registry.has('User')).toBe(true);
      expect(registry.get('User')).toBe(model);
      expect(registry.size).toBe(1);
    });

    it('should overwrite an unsealed model', () => {
      const model1 = createMockModel('Post');
      const model2 = createMockModel('Post', { version: 2 });

      registry.register('Post', model1);
      registry.register('Post', model2);

      expect(registry.get('Post')).toBe(model2);
      expect(registry.size).toBe(1);
    });

    it('should throw when overwriting a sealed core model', () => {
      registry.register('User', createMockModel('User'));
      registry.seal();

      expect(() => {
        registry.register('User', createMockModel('User'));
      }).toThrow(/Cannot overwrite core model "User"/);

      try {
        registry.register('User', createMockModel('User'));
      } catch (err) {
        expect(err.name).toBe('CoreModelError');
        expect(err.code).toBe('E_CORE_MODEL_SEALED');
      }
    });

    it('should allow registering new models after sealing', () => {
      registry.register('User', createMockModel('User'));
      registry.seal();

      const post = createMockModel('Post');
      registry.register('Post', post);

      expect(registry.has('Post')).toBe(true);
      expect(registry.get('Post')).toBe(post);
    });
  });

  // =========================================================================
  // Unregistration
  // =========================================================================

  describe('unregister()', () => {
    describe('single model removal', () => {
      it('should remove a registered model', () => {
        registry.register('Post', createMockModel('Post'));
        const result = registry.unregister('Post');

        expect(result).toBe(true);
        expect(registry.has('Post')).toBe(false);
        expect(registry.size).toBe(0);
      });

      it('should return false for non-existent model', () => {
        const result = registry.unregister('Ghost');
        expect(result).toBe(false);
      });

      it('should throw when removing a sealed core model', () => {
        registry.register('User', createMockModel('User'));
        registry.seal();

        expect(() => {
          registry.unregister('User');
        }).toThrow(/Cannot unregister core model "User"/);

        try {
          registry.unregister('User');
        } catch (err) {
          expect(err.name).toBe('CoreModelError');
          expect(err.code).toBe('E_CORE_MODEL_SEALED');
        }
      });
    });

    describe('source-based removal', () => {
      it('should remove all models from a discovered source', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Post.js': { default: () => createMockModel('Post') },
            './Comment.js': { default: () => createMockModel('Comment') },
          }),
        );

        await registry.discover({}, 'blog-extension');

        expect(registry.has('Post')).toBe(true);
        expect(registry.has('Comment')).toBe(true);
        expect(registry.size).toBe(2);

        const removed = registry.unregister('blog-extension');

        expect(removed).toEqual(['Post', 'Comment']);
        expect(registry.has('Post')).toBe(false);
        expect(registry.has('Comment')).toBe(false);
        expect(registry.size).toBe(0);
      });

      it('should allow re-discovery of an unregistered source', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Post.js': { default: () => createMockModel('Post') },
          }),
        );

        await registry.discover({}, 'blog');
        expect(registry.size).toBe(1);

        registry.unregister('blog');
        expect(registry.size).toBe(0);

        // Re-discover the same source after unregister
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Post.js': { default: () => createMockModel('Post') },
          }),
        );

        const { registered } = await registry.discover({}, 'blog');
        expect(registered).toEqual(['Post']);
        expect(registry.size).toBe(1);
      });
    });
  });

  // =========================================================================
  // Discovery
  // =========================================================================

  describe('discover()', () => {
    it('should discover models from a webpack context', async () => {
      createWebpackContextAdapter.mockReturnValue(
        createMockAdapter({
          './User.js': { default: () => createMockModel('User') },
          './Role.js': { default: () => createMockModel('Role') },
        }),
      );

      const { registered, errors } = await registry.discover({}, 'users');

      expect(registered).toEqual(['User', 'Role']);
      expect(errors).toHaveLength(0);
      expect(registry.size).toBe(2);
      expect(registry.has('User')).toBe(true);
      expect(registry.has('Role')).toBe(true);
    });

    it('should return empty result when db is null', async () => {
      const r = new ModelRegistry(null);
      const { registered, errors } = await r.discover({}, 'test');

      expect(registered).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('should return empty result when context is null', async () => {
      const { registered, errors } = await registry.discover(null, 'test');

      expect(registered).toEqual([]);
      expect(errors).toEqual([]);
    });

    describe('idempotency', () => {
      it('should skip re-discovery of an already-processed source', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': { default: () => createMockModel('User') },
          }),
        );

        const first = await registry.discover({}, 'users');
        expect(first.registered).toEqual(['User']);

        // Second call with same source — should be a no-op
        const second = await registry.discover({}, 'users');
        expect(second.registered).toEqual([]);
        expect(second.errors).toEqual([]);

        // createWebpackContextAdapter should only have been called once
        expect(createWebpackContextAdapter).toHaveBeenCalledTimes(1);
      });

      it('should track empty sources for idempotency', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './index.js': { default: () => null }, // filtered out
          }),
        );

        const first = await registry.discover({}, 'empty-source');
        expect(first.registered).toEqual([]);

        // Second call should be short-circuited
        const second = await registry.discover({}, 'empty-source');
        expect(second.registered).toEqual([]);
        expect(createWebpackContextAdapter).toHaveBeenCalledTimes(1);
      });
    });

    describe('file filtering', () => {
      it('should skip index files', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './index.js': { default: () => createMockModel('Index') },
            './index.ts': { default: () => createMockModel('IndexTs') },
            './index.cjs': { default: () => createMockModel('IndexCjs') },
            './User.js': { default: () => createMockModel('User') },
          }),
        );

        const { registered } = await registry.discover({}, 'filtered');
        expect(registered).toEqual(['User']);
      });

      it('should skip test/spec files', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.test.js': { default: () => createMockModel('UserTest') },
            './Role.spec.ts': { default: () => createMockModel('RoleSpec') },
            './Permission.js': {
              default: () => createMockModel('Permission'),
            },
          }),
        );

        const { registered } = await registry.discover({}, 'filtered');
        expect(registered).toEqual(['Permission']);
      });
    });

    describe('factory handling', () => {
      it('should use default export when available', async () => {
        const model = createMockModel('User');
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': { default: () => model },
          }),
        );

        await registry.discover({}, 'test');
        expect(registry.get('User')).toBe(model);
      });

      it('should fall back to module itself when no default export', async () => {
        const factory = () => createMockModel('User');
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': factory,
          }),
        );

        await registry.discover({}, 'test');
        expect(registry.has('User')).toBe(true);
      });

      it('should handle async factories', async () => {
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': {
              default: async () => createMockModel('User'),
            },
          }),
        );

        const { registered } = await registry.discover({}, 'async');
        expect(registered).toEqual(['User']);
      });

      it('should warn and skip non-function exports', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Bad.js': { default: 'not a function' },
          }),
        );

        const { registered } = await registry.discover({}, 'bad');
        expect(registered).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('does not export a factory function'),
        );

        warnSpy.mockRestore();
      });

      it('should warn and skip factories that return null', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Null.js': { default: () => null },
          }),
        );

        const { registered } = await registry.discover({}, 'null-factory');
        expect(registered).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('did not return a valid object'),
        );

        warnSpy.mockRestore();
      });

      it('should warn and skip models without a name property', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './NoName.js': { default: () => ({ tableName: 'no_name' }) },
          }),
        );

        const { registered } = await registry.discover({}, 'no-name');
        expect(registered).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('without a name property'),
        );

        warnSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should capture factory errors without stopping discovery', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Broken.js': {
              default: () => {
                throw new Error('Factory explosion');
              },
            },
            './Valid.js': { default: () => createMockModel('Valid') },
          }),
        );

        const { registered, errors } = await registry.discover({}, 'mixed');

        expect(registered).toEqual(['Valid']);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Factory explosion');
        expect(errors[0].moduleName).toBe('mixed');
        expect(errors[0].path).toBe('./Broken.js');

        errorSpy.mockRestore();
      });

      it('should capture async factory rejections', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './Async.js': {
              default: () => Promise.reject(new Error('Async fail')),
            },
          }),
        );

        const { errors } = await registry.discover({}, 'async-fail');
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Async fail');

        errorSpy.mockRestore();
      });
    });

    describe('duplicate handling', () => {
      it('should silently skip models already registered by another source', async () => {
        // First source registers User
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': { default: () => createMockModel('User') },
          }),
        );
        await registry.discover({}, 'source-a');

        // Second source also has User — should be skipped
        createWebpackContextAdapter.mockReturnValue(
          createMockAdapter({
            './User.js': {
              default: () => createMockModel('User', { version: 2 }),
            },
            './Post.js': { default: () => createMockModel('Post') },
          }),
        );
        const { registered } = await registry.discover({}, 'source-b');

        // Only Post registered, User silently skipped
        expect(registered).toEqual(['Post']);
        expect(registry.size).toBe(2);

        // Original User from source-a is preserved
        expect(registry.get('User').version).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // Associations
  // =========================================================================

  describe('associate()', () => {
    it('should call associate() on all models with the registry proxy', () => {
      const userAssociate = jest.fn();
      const postAssociate = jest.fn();

      registry.register('User', createMockModel('User', { associate: userAssociate }));
      registry.register('Post', createMockModel('Post', { associate: postAssociate }));

      const errors = registry.associate();

      expect(errors).toHaveLength(0);
      expect(userAssociate).toHaveBeenCalledWith(registry);
      expect(postAssociate).toHaveBeenCalledWith(registry);
    });

    it('should skip models without associate()', () => {
      registry.register('User', createMockModel('User'));

      const errors = registry.associate();
      expect(errors).toHaveLength(0);
    });

    it('should not re-associate already-associated models', () => {
      const associateFn = jest.fn();
      registry.register('User', createMockModel('User', { associate: associateFn }));

      registry.associate();
      registry.associate();

      expect(associateFn).toHaveBeenCalledTimes(1);
    });

    it('should capture association errors without stopping', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      registry.register(
        'Broken',
        createMockModel('Broken', {
          associate: () => {
            throw new Error('Association failed');
          },
        }),
      );
      registry.register(
        'Good',
        createMockModel('Good', { associate: jest.fn() }),
      );

      const errors = registry.associate();

      expect(errors).toHaveLength(1);
      expect(errors[0].moduleName).toBe('Broken');
      expect(errors[0].message).toBe('Association failed');

      // Good model should still have been associated
      const goodAssociate = registry.get('Good').associate;
      expect(goodAssociate).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should associate new models added after first associate() call', () => {
      const userAssociate = jest.fn();
      registry.register('User', createMockModel('User', { associate: userAssociate }));
      registry.associate();

      const postAssociate = jest.fn();
      registry.register('Post', createMockModel('Post', { associate: postAssociate }));
      registry.associate();

      expect(userAssociate).toHaveBeenCalledTimes(1);
      expect(postAssociate).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Sealing
  // =========================================================================

  describe('seal()', () => {
    it('should mark all current models as core', () => {
      registry.register('User', createMockModel('User'));
      registry.register('Role', createMockModel('Role'));
      registry.seal();

      expect(registry.isCore('User')).toBe(true);
      expect(registry.isCore('Role')).toBe(true);
    });

    it('should not seal models registered after seal()', () => {
      registry.register('User', createMockModel('User'));
      registry.seal();
      registry.register('Post', createMockModel('Post'));

      expect(registry.isCore('User')).toBe(true);
      expect(registry.isCore('Post')).toBe(false);
    });

    it('should be a no-op on subsequent calls', () => {
      registry.register('User', createMockModel('User'));
      registry.seal();

      registry.register('Post', createMockModel('Post'));
      registry.seal(); // Should not seal Post

      expect(registry.isCore('User')).toBe(true);
      expect(registry.isCore('Post')).toBe(false);
    });
  });

  // =========================================================================
  // Inspection Methods
  // =========================================================================

  describe('has()', () => {
    it('should return true for registered models', () => {
      registry.register('User', createMockModel('User'));
      expect(registry.has('User')).toBe(true);
    });

    it('should return false for unregistered models', () => {
      expect(registry.has('Ghost')).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return the model object', () => {
      const model = createMockModel('User');
      registry.register('User', model);
      expect(registry.get('User')).toBe(model);
    });

    it('should return undefined for unregistered models', () => {
      expect(registry.get('Ghost')).toBeUndefined();
    });
  });

  describe('names()', () => {
    it('should return all registered model names in insertion order', () => {
      registry.register('User', createMockModel('User'));
      registry.register('Role', createMockModel('Role'));
      registry.register('Post', createMockModel('Post'));

      expect(registry.names()).toEqual(['User', 'Role', 'Post']);
    });
  });

  describe('isCore()', () => {
    it('should return false before sealing', () => {
      registry.register('User', createMockModel('User'));
      expect(registry.isCore('User')).toBe(false);
    });

    it('should return true after sealing', () => {
      registry.register('User', createMockModel('User'));
      registry.seal();
      expect(registry.isCore('User')).toBe(true);
    });
  });

  describe('size', () => {
    it('should reflect the number of registered models', () => {
      expect(registry.size).toBe(0);
      registry.register('A', createMockModel('A'));
      expect(registry.size).toBe(1);
      registry.register('B', createMockModel('B'));
      expect(registry.size).toBe(2);
      registry.unregister('A');
      expect(registry.size).toBe(1);
    });
  });

  // =========================================================================
  // Proxy Behavior
  // =========================================================================

  describe('Proxy', () => {
    describe('get trap', () => {
      it('should allow property access for registered models', () => {
        const user = createMockModel('User');
        registry.register('User', user);
        expect(registry.User).toBe(user);
      });

      it('should return undefined for unregistered models', () => {
        expect(registry.Ghost).toBeUndefined();
      });

      it('should prioritise own methods over model names', () => {
        // Even if a model is named "has", the method should win
        registry.register('size', createMockModel('size'));
        expect(typeof registry.has).toBe('function');
      });
    });

    describe('set trap', () => {
      it('should delegate property assignment to register()', () => {
        const post = createMockModel('Post');
        registry.Post = post;

        expect(registry.has('Post')).toBe(true);
        expect(registry.get('Post')).toBe(post);
      });

      it('should throw on assignment to sealed core model', () => {
        registry.register('User', createMockModel('User'));
        registry.seal();

        expect(() => {
          registry.User = createMockModel('UserV2');
        }).toThrow(/Cannot overwrite core model "User"/);
      });
    });

    describe('has trap (in operator)', () => {
      it('should return true for registered models', () => {
        registry.register('User', createMockModel('User'));
        expect('User' in registry).toBe(true);
      });

      it('should return true for own methods', () => {
        expect('register' in registry).toBe(true);
        expect('has' in registry).toBe(true);
      });

      it('should return false for unregistered models', () => {
        expect('Ghost' in registry).toBe(false);
      });
    });

    describe('ownKeys trap', () => {
      it('should include model names in Object.keys()', () => {
        registry.register('User', createMockModel('User'));
        registry.register('Post', createMockModel('Post'));

        const keys = Object.keys(registry);
        expect(keys).toContain('User');
        expect(keys).toContain('Post');
      });
    });

    describe('destructuring', () => {
      it('should support destructuring', () => {
        const user = createMockModel('User');
        const post = createMockModel('Post');
        registry.register('User', user);
        registry.register('Post', post);

        const { User, Post } = registry;
        expect(User).toBe(user);
        expect(Post).toBe(post);
      });

      it('should return undefined for missing models when destructuring', () => {
        const { Ghost } = registry;
        expect(Ghost).toBeUndefined();
      });
    });
  });
});
