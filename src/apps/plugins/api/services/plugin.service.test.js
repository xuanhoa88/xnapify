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

jest.mock('../utils/activity', () => ({
  logPluginActivity: jest.fn(),
}));

jest.mock('../utils/crypto', () => ({
  encryptPluginId: jest.fn(id => `enc_${id}`),
  decryptPluginId: jest.fn(id => id.replace('enc_', '')),
}));

import {
  managePlugins,
  getActivePlugins,
  togglePluginStatus,
} from './plugin.service';
import fs from 'fs';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockModels = {
  Plugin: {
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

const mockWebhook = { send: jest.fn() };
const mockContext = {
  models: mockModels,
  cache: mockCache,
  webhook: mockWebhook,
  actorId: 'user-123',
  cwd: '/test/cwd',
  queue: mockQueue,
};

describe('Plugin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  describe('managePlugins', () => {
    it('should list plugins from DB and FS', async () => {
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
      // fs.promises.readFile is used in readPluginManifest
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('fs-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'fs-plugin',
              version: '1.0.0',
              rsk: { name: 'FS Plugin', plugin: { key: 'fs-plugin' } },
            }),
          );
        }
        if (path.includes('local-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'local-plugin',
              version: '1.0.0',
              rsk: { name: 'Local Plugin', plugin: { key: 'local-plugin' } },
            }),
          );
        }
        // DB plugin (exists in DB, assumed in FS for this test case setup)
        if (path.includes('db-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'db-plugin',
              version: '1.0.0',
              rsk: { name: 'DB Plugin', plugin: { key: 'db-plugin' } },
            }),
          );
        }
        return Promise.reject('File not found');
      });

      // Mock DB
      mockModels.Plugin.findAll.mockResolvedValue([
        {
          id: 'db-1',
          key: 'db-plugin',
          is_active: true,
          toJSON: () => ({
            name: 'DB Plugin',
            key: 'db-plugin',
            is_active: true,
          }),
        },
      ]);

      // Set local plugin path to differ from installed path
      process.env.RSK_PLUGIN_LOCAL_PATH = 'local-plugins';

      const result = await managePlugins(mockContext);

      expect(result).toHaveLength(3);

      const fsPlugin = result.find(p => p.name === 'FS Plugin');
      expect(fsPlugin).toBeDefined();
      expect(fsPlugin.isInstalled).toBe(false);
      expect(fsPlugin.source).toBe('remote');

      const localPlugin = result.find(p => p.name === 'Local Plugin');
      expect(localPlugin).toBeDefined();
      expect(localPlugin.source).toBe('local');

      const dbPlugin = result.find(p => p.key === 'db-plugin');
      expect(dbPlugin).toBeDefined();
      expect(dbPlugin.source).toBe('db');
    });

    it('should mark DB plugins as missing if not found on FS', async () => {
      fs.promises.readdir.mockResolvedValue([]); // No files
      mockModels.Plugin.findAll.mockResolvedValue([
        {
          id: 'db-1',
          key: 'missing-plugin',
          is_active: true,
          toJSON: () => ({
            name: 'Missing Plugin',
            key: 'missing-plugin',
            is_active: true,
          }),
        },
      ]);

      const result = await managePlugins(mockContext);
      const missingPlugin = result.find(p => p.key === 'missing-plugin');
      expect(missingPlugin).toBeDefined();
      expect(missingPlugin.source).toBe('db');
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
              rsk: { name: 'New Plugin', plugin: { key: 'new-plugin' } },
            }),
          );
        }
        return Promise.reject('File not found');
      });

      mockModels.Plugin.findAll.mockResolvedValue([]);

      const result = await managePlugins(mockContext);

      expect(result).toHaveLength(1);
      const plugin = result[0];
      expect(plugin.name).toBe('New Plugin');
      expect(plugin.isInstalled).toBe(false);
      expect(plugin.isActive).toBe(false);
    });
  });

  describe('getActivePlugins', () => {
    it('should return only active plugins from DB and verify FS', async () => {
      // Mock DB to return only active plugins
      mockModels.Plugin.findAll.mockResolvedValue([
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
      // getActivePlugins uses readPluginManifest which uses fs.readFile

      const result = await getActivePlugins(mockContext);

      expect(mockModels.Plugin.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('active-p');
    });
  });

  describe('togglePluginStatus', () => {
    it('should update status and enqueue background job', async () => {
      const mockPlugin = {
        id: 'p1',
        key: 'plugin-1',
        update: jest.fn(),
      };
      mockModels.Plugin.findByPk.mockResolvedValue(mockPlugin);

      await togglePluginStatus('p1', true, mockContext);

      expect(mockPlugin.update).toHaveBeenCalledWith({ is_active: true });
      expect(mockQueue).toHaveBeenCalledWith('plugins');
      expect(mockQueueChannel.emit).toHaveBeenCalledWith('toggle', {
        pluginId: 'p1',
        pluginKey: 'plugin-1',
        pluginDir: expect.any(String),
        isActive: true,
        actorId: 'user-123',
        isDevPlugin: true, // local/dev path is checked first
      });
    });
  });
});
