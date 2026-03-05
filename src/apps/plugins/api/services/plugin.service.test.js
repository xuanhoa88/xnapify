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
              name: 'FS Plugin',
              version: '1.0.0',
              rsk: { plugin: { key: 'fs-plugin' } },
            }),
          );
        }
        if (path.includes('local-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'Local Plugin',
              version: '1.0.0',
              rsk: { plugin: { key: 'local-plugin' } },
            }),
          );
        }
        // DB plugin (exists in DB, assumed in FS for this test case setup)
        if (path.includes('db-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'DB Plugin',
              version: '1.0.0',
              rsk: { plugin: { key: 'db-plugin' } },
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

      // Override environment variable for local path in test context if needed,
      // but since service uses process.env, we might need to mock getPluginsDir behavior or env.
      // However, managing env mocks can be tricky.
      // Instead, we can rely on how `getPluginsDir` works.
      // The issue is `getPluginsDir` uses process.env.RSK_LOCAL_PLUGIN_PATH || 'plugins'.
      // If we can't change env, both dirs are the same.
      // We need to mock `getPluginsDir` or the values it returns.
      // Since `getPluginsDir` is internal, we can't easily mock it without rewriting the test to import it?
      // Actually, the service exports `managePlugins`.
      // Let's assume for this test we want to verify distinct behavior.
      // If we can't easily change the paths, we can at least verify the property based on the source arg passed to scanDirectory.
      // But scanDirectory is internal.

      // WAIT: The user request is to "check again for scanDirectory to matching with my expect isLocal".
      // The fix is to ensure the TEST reflects reality.
      // In this specific test file, we don't control process.env easily inside the module scope variables.
      // But we can check if `local-plugin` gets `isLocal: true` and `fs-plugin` gets `isLocal: false`
      // IF we could force them to be scanned from different source calls.

      // Let's modify the test to manually checking what we get.
      // Actually, we can just spy on scanDirectory? No, it's not exported.

      // Let's rely on the fact that `managePlugins` calls:
      // await scanDirectory(installedPluginsDir, 'remote', fsPluginsMap);
      // await scanDirectory(localPluginsDir, 'local', fsPluginsMap);

      // If installedPluginsDir === localPluginsDir, then 'remote' scan happens first, then 'local' scan.
      // The second scan ('local') will OVERWRITE the first one for the SAME directory.
      // So EVERYTHING becomes local.

      // We need to Mock `getPluginsDir` or `process.env`.
      process.env.RSK_LOCAL_PLUGIN_PATH = 'local-plugins';

      const result = await managePlugins(mockContext);

      expect(result).toHaveLength(3);
      // local-plugins -> [local-plugin]

      // And DB has 'db-plugin'.
      // Logic:
      // 1. Scan remote (plugins) -> found fs-plugin
      // 2. Scan local (local-plugins) -> found local-plugin
      // 3. DB has db-plugin.
      // if db-plugin is NOT in fsPluginsMap, it's marked missing.

      // Let's adjust expectations:

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
              name: 'New Plugin',
              version: '1.0.0',
              rsk: { plugin: { key: 'new-plugin' } },
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
        isDevPlugin: false,
      });
    });
  });
});
