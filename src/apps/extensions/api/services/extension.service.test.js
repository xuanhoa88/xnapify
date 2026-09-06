/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Mock fs (for existsSync and fs.promises.rm, etc.)
jest.mock('fs', () => {
  const mockRm = jest.fn();
  const mockMkdir = jest.fn();
  const mockRename = jest.fn();
  const mockUnlink = jest.fn();
  const actualFs = jest.requireActual('fs');
  const mockExistsSync = jest.fn(path => {
    if (typeof path === 'string' && path.includes('node_modules')) {
      return actualFs.existsSync(path);
    }
    return false;
  });
  const mockAccess = jest.fn();

  const mockFs = {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      rm: mockRm,
      mkdir: mockMkdir,
      rename: mockRename,
      unlink: mockUnlink,
      readdir: jest.fn(),
      readFile: jest.fn(),
    },
    rm: mockRm,
    mkdir: mockMkdir,
    rename: mockRename,
    unlink: mockUnlink,
    existsSync: mockExistsSync,
    access: mockAccess,
  };

  return {
    default: mockFs,
    ...mockFs,
  };
});

// Mock fs/promises (the named imports used by readdir/readFile in the service)
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

import fs from 'fs';
import path from 'path';

import {
  manageExtensions,
  getActiveExtensions,
  toggleExtensionStatus,
} from './extension.service.js';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockModels = {
  Extension: {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockQueueChannel = {
  emit: jest.fn(),
  invoke: jest.fn(),
  on: jest.fn(),
  queue: {
    getJobs: jest.fn(() => []),
  },
};
const mockQueue = jest.fn(() => mockQueueChannel);

const mockExtensionManager = {
  getExtensionMetadata: () => null,
  getInstalledExtensionsDir: () => '/mock/extensions',
  getDevExtensionsDir: cwd =>
    path.resolve(cwd, process.env.XNAPIFY_EXTENSION_LOCAL_PATH || 'extensions'),
  readManifest: async (dirPath, dirName) => {
    const filePath = dirName
      ? path.join(dirPath, dirName, 'package.json')
      : path.join(dirPath, 'package.json');
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const manifest = JSON.parse(raw);
      // Mirror real readManifest: always auto-generate id from name
      if (manifest.name) {
        manifest.id = manifest.name
          .replace(/[@/]/g, '')
          .replace(/[^a-z0-9]+/gi, '_')
          .toLowerCase();
      }
      return manifest;
    } catch {
      return null;
    }
  },
  resolveExtensionDir: async key => ({
    dir: `/mock/extensions/${key}`,
    isDevExtension: true,
  }),
};

const mockContext = {
  extensionManager: mockExtensionManager,
  models: mockModels,
  cache: mockCache,
  actorId: 'user-123',
  cwd: '/test/cwd',
  queue: mockQueue,
};

describe('Extension Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue.mockReturnValue(mockQueueChannel);
    mockQueueChannel.queue.getJobs.mockResolvedValue([]);
    mockCache.get.mockResolvedValue(null);
  });

  describe('manageExtensions', () => {
    it('should list extensions from DB and FS', async () => {
      // Mock FS via imported mocked module
      // Mock FS via fs.promises.readdir used in service for sequential calls
      fs.promises.readdir.mockResolvedValue([]);
      // 1st call: Installed extensions (remote)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'fs-extension', isDirectory: () => true },
      ]);
      // 2nd call: Local extensions (local)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'local-extension', isDirectory: () => true },
      ]);

      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('fs-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'fs-extension',
              version: '1.0.0',
            }),
          );
        }
        if (path.includes('local-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'local-extension',
              version: '1.0.0',
            }),
          );
        }
        // DB extension (exists in DB, assumed in FS for this test case setup)
        if (path.includes('db-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'db-extension',
              version: '1.0.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      const mockDbUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'db-extension',
          key: 'db-extension',
          is_active: true,
          update: mockDbUpdate,
          toJSON: () => ({
            name: 'DB Extension',
            key: 'db-extension',
            is_active: true,
          }),
        },
      ]);

      // Set local extension path to differ from installed path
      process.env.XNAPIFY_EXTENSION_LOCAL_PATH = 'local-extensions';

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(2);

      const fsExtension = result.find(p => p.name === 'fs-extension');
      expect(fsExtension).toBeDefined();
      expect(fsExtension.isInstalled).toBe(false);
      expect(fsExtension.source).toBe('remote');

      const localExtension = result.find(p => p.name === 'local-extension');
      expect(localExtension).toBeDefined();
      expect(localExtension.source).toBe('local');

      const dbExtension = result.find(p => p.key === 'db-extension');
      expect(dbExtension).toBeUndefined();
      expect(mockDbUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should deactivate DB extensions if not found on FS', async () => {
      fs.promises.readdir.mockResolvedValue([]); // No files
      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'missing-extension',
          key: 'missing-extension',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Missing Extension',
            key: 'missing-extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);
      const missingExtension = result.find(p => p.key === 'missing-extension');
      expect(missingExtension).toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should re-key a DB row whose stored key no longer matches the manifest', async () => {
      // An extension id is derived from its manifest name, so changing the
      // derivation rewrites every id on the next build. The DB row still holds
      // the old one; without a name-based match it looks like the extension was
      // deleted and gets silently deactivated.
      fs.promises.readdir.mockResolvedValue([
        { name: 'renamed-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p => {
        if (p.includes('renamed-extension')) {
          return Promise.resolve(
            JSON.stringify({ name: 'renamed-extension', version: '1.0.0' }),
          );
        }
        return Promise.reject('File not found');
      });

      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          name: 'renamed-extension',
          key: 'stale-key-from-an-older-build',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'renamed-extension',
            key: 'renamed_extension',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith({ key: 'renamed_extension' });
      expect(mockUpdate).not.toHaveBeenCalledWith({ is_active: false });

      const extension = result.find(p => p.name === 'renamed-extension');
      expect(extension).toBeDefined();
      expect(extension.isInstalled).toBe(true);
      expect(extension.isActive).toBe(true);
    });

    it('should list FS-only extensions when DB is empty', async () => {
      fs.promises.readdir.mockResolvedValue([
        { name: 'new-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p => {
        if (p.includes('new-extension')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'new-extension',
              version: '1.0.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      mockModels.Extension.findAll.mockResolvedValue([]);

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(1);
      const extension = result[0];
      expect(extension.name).toBe('new-extension');
      expect(extension.isInstalled).toBe(false);
      expect(extension.isActive).toBe(false);
    });

    it('reads runtime state live instead of serving it from the list cache', async () => {
      // An extension that crashes while booting writes nothing to the DB and
      // never invalidates this cache, so a cached `runtime` block would keep
      // the admin UI reporting a dead extension as healthy for the whole TTL.
      mockCache.get.mockResolvedValue([
        {
          id: 'cached-extension',
          name: 'cached-extension',
          runtime: { state: 'active', error: null, loadedAt: 1 },
        },
      ]);

      const failing = {
        ...mockExtensionManager,
        getExtensionMetadata: jest.fn(() => ({
          state: 'error',
          error: new Error('boom'),
          loadedAt: null,
        })),
      };

      const result = await manageExtensions({
        ...mockContext,
        extensionManager: failing,
      });

      expect(mockModels.Extension.findAll).not.toHaveBeenCalled();
      expect(result[0].runtime).toEqual({
        state: 'error',
        error: 'boom',
        loadedAt: null,
      });
    });

    it('falls back to inactive when the manager knows nothing about an entry', async () => {
      mockCache.get.mockResolvedValue([{ id: 'unknown', name: 'unknown' }]);

      const result = await manageExtensions(mockContext);

      expect(result[0].runtime).toEqual({
        state: 'inactive',
        error: null,
        loadedAt: null,
      });
    });

    it('does not persist the runtime block into the cache', async () => {
      fs.promises.readdir.mockResolvedValue([
        { name: 'new-extension', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p =>
        p.includes('new-extension')
          ? Promise.resolve(
              JSON.stringify({ name: 'new-extension', version: '1.0.0' }),
            )
          : Promise.reject('File not found'),
      );
      mockModels.Extension.findAll.mockResolvedValue([]);

      await manageExtensions(mockContext);

      const [, cached] = mockCache.set.mock.calls[0];
      expect(cached[0]).not.toHaveProperty('runtime');
    });
  });

  describe('getActiveExtensions', () => {
    it('should return only active extensions from DB and verify FS', async () => {
      // Mock DB to return only active extensions
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'active-1',
          name: 'active-p',
          key: 'active-p',
          is_active: true,
          toJSON: () => ({ name: 'Active', key: 'active-p', is_active: true }),
        },
      ]);

      // Mock FS check
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('active-p')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'Active',
              version: '1.0',
            }),
          );
        }
        return Promise.reject('File not found');
      });

      const result = await getActiveExtensions(mockContext);

      expect(mockModels.Extension.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('active-p');
    });
  });

  describe('toggleExtensionStatus', () => {
    it('should update status and enqueue background job', async () => {
      const mockExtension = {
        id: 'p1',
        key: 'extension-1',
        update: jest.fn(),
      };
      mockModels.Extension.findOne.mockResolvedValue(mockExtension);

      await toggleExtensionStatus('p1', true, mockContext);

      expect(mockExtension.update).toHaveBeenCalledWith({ is_active: true });
      expect(mockQueue).toHaveBeenCalledWith('extensions');
      expect(mockQueueChannel.emit).toHaveBeenCalledWith('toggle', {
        extensionKey: 'extension-1',
        extensionDir: expect.any(String),
        isActive: true,
        actorId: 'user-123',
        isDevExtension: true,
      });
    });
  });
});
