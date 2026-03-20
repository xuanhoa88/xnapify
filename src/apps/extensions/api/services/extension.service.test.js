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
    __esModule: true,
    default: mockFs,
    ...mockFs,
  };
});

// Mock fs/promises (the named imports used by readdir/readFile in the service)
jest.mock('fs/promises', () => ({
  __esModule: true,
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('../utils/crypto', () => ({
  encryptExtensionId: jest.fn(id => `enc_${id}`),
  decryptExtensionId: jest.fn(id => id.replace('enc_', '')),
}));

import fs from 'fs';
import path from 'path';

import {
  manageExtensions,
  getActiveExtensions,
  toggleExtensionStatus,
} from './extension.service';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockModels = {
  Extension: {
    findAll: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockQueueChannel = {
  emit: jest.fn(),
  on: jest.fn(),
  queue: {
    getJobs: jest.fn(() => []),
  },
};
const mockQueue = jest.fn(() => mockQueueChannel);

const mockExtensionManager = {
  getExtensionPath: jest.fn(() => '/mock/plugins'),
  getDevExtensionPath: jest.fn(cwd =>
    path.resolve(cwd, process.env.RSK_PLUGIN_LOCAL_PATH || 'plugins'),
  ),
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
    mockCache.get.mockResolvedValue(null);
  });

  describe('manageExtensions', () => {
    it('should list extensions from DB and FS', async () => {
      // Mock FS via imported mocked module
      // Mock FS via fs.promises.readdir used in service for sequential calls
      // 1st call: Installed plugins (remote)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'fs-plugin', isDirectory: () => true },
      ]);
      // 2nd call: Local plugins (local)
      fs.promises.readdir.mockResolvedValueOnce([
        { name: 'local-plugin', isDirectory: () => true },
      ]);

      fs.existsSync.mockReturnValue(true);
      // fs.promises.readFile is used in readExtensionManifest
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('fs-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'fs-plugin',
              version: '1.0.0',
              rsk: { name: 'FS Extension', plugin: { key: 'fs-plugin' } },
            }),
          );
        }
        if (path.includes('local-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'local-plugin',
              version: '1.0.0',
              rsk: { name: 'Local Extension', plugin: { key: 'local-plugin' } },
            }),
          );
        }
        // DB plugin (exists in DB, assumed in FS for this test case setup)
        if (path.includes('db-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'db-plugin',
              version: '1.0.0',
              rsk: { name: 'DB Extension', plugin: { key: 'db-plugin' } },
            }),
          );
        }
        return Promise.reject('File not found');
      });

      const mockDbUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          key: 'db-plugin',
          is_active: true,
          update: mockDbUpdate,
          toJSON: () => ({
            name: 'DB Extension',
            key: 'db-plugin',
            is_active: true,
          }),
        },
      ]);

      // Set local plugin path to differ from installed path
      process.env.RSK_PLUGIN_LOCAL_PATH = 'local-plugins';

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(2);

      const fsExtension = result.find(p => p.name === 'FS Extension');
      expect(fsExtension).toBeDefined();
      expect(fsExtension.isInstalled).toBe(false);
      expect(fsExtension.source).toBe('remote');

      const localExtension = result.find(p => p.name === 'Local Extension');
      expect(localExtension).toBeDefined();
      expect(localExtension.source).toBe('local');

      const dbExtension = result.find(p => p.key === 'db-plugin');
      expect(dbExtension).toBeUndefined();
      expect(mockDbUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should deactivate DB plugins if not found on FS', async () => {
      fs.promises.readdir.mockResolvedValue([]); // No files
      const mockUpdate = jest.fn();
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'db-1',
          key: 'missing-plugin',
          is_active: true,
          update: mockUpdate,
          toJSON: () => ({
            name: 'Missing Extension',
            key: 'missing-plugin',
            is_active: true,
          }),
        },
      ]);

      const result = await manageExtensions(mockContext);
      const missingPlugin = result.find(p => p.key === 'missing-plugin');
      expect(missingPlugin).toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('should list FS-only plugins when DB is empty', async () => {
      fs.promises.readdir.mockResolvedValue([
        { name: 'new-plugin', isDirectory: () => true },
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(p => {
        if (p.includes('new-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'new-plugin',
              version: '1.0.0',
              rsk: { name: 'New Extension', plugin: { key: 'new-plugin' } },
            }),
          );
        }
        return Promise.reject('File not found');
      });

      mockModels.Extension.findAll.mockResolvedValue([]);

      const result = await manageExtensions(mockContext);

      expect(result).toHaveLength(1);
      const plugin = result[0];
      expect(plugin.name).toBe('New Extension');
      expect(plugin.isInstalled).toBe(false);
      expect(plugin.isActive).toBe(false);
    });
  });

  describe('getActiveExtensions', () => {
    it('should return only active extensions from DB and verify FS', async () => {
      // Mock DB to return only active extensions
      mockModels.Extension.findAll.mockResolvedValue([
        {
          id: 'active-1',
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
              rsk: { plugin: { key: 'active-p' } },
            }),
          );
        }
        return Promise.reject('File not found');
      });
      // getActiveExtensions uses readExtensionManifest which uses fs.readFile

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
      mockModels.Extension.findByPk.mockResolvedValue(mockExtension);

      await toggleExtensionStatus('p1', true, mockContext);

      expect(mockExtension.update).toHaveBeenCalledWith({ is_active: true });
      expect(mockQueue).toHaveBeenCalledWith('extensions');
      expect(mockQueueChannel.emit).toHaveBeenCalledWith('toggle', {
        extensionId: 'p1',
        extensionKey: 'extension-1',
        extensionDir: expect.any(String),
        isActive: true,
        actorId: 'user-123',
        isDevExtension: true, // local/dev path is checked first
      });
    });
  });
});
