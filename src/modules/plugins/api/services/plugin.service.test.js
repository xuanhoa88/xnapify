// Mock dependencies
jest.mock('fs', () => {
  const mockReaddir = jest.fn();
  const mockReadFile = jest.fn();
  const mockStat = jest.fn();
  const mockRm = jest.fn();
  const mockMkdir = jest.fn();
  const mockRename = jest.fn();
  const mockUnlink = jest.fn();
  const mockExistsSync = jest.fn();

  const mockFs = {
    promises: {
      readdir: mockReaddir,
      readFile: mockReadFile,
      stat: mockStat,
      rm: mockRm,
      mkdir: mockMkdir,
      rename: mockRename,
      unlink: mockUnlink,
    },
    readdir: mockReaddir,
    readFile: mockReadFile,
    stat: mockStat,
    rm: mockRm,
    mkdir: mockMkdir,
    rename: mockRename,
    unlink: mockUnlink,
    existsSync: mockExistsSync,
  };

  return {
    __esModule: true,
    default: mockFs,
    ...mockFs,
  };
});

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
  createPlugin,
  togglePluginStatus,
} from './plugin.service';
import * as activityUtils from '../utils/activity';
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

const mockWebhook = { send: jest.fn() };
const mockContext = {
  models: mockModels,
  cache: mockCache,
  webhook: mockWebhook,
  actorId: 'user-123',
  cwd: '/test/cwd',
};

describe('Plugin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  describe('managePlugins', () => {
    it('should list plugins from DB and FS', async () => {
      // Mock FS via imported mocked module
      fs.promises.readdir.mockResolvedValue([
        { name: 'fs-plugin', isDirectory: () => true },
        { name: 'db-plugin', isDirectory: () => true }, // Add db-plugin folder
      ]);
      fs.existsSync.mockReturnValue(true);
      fs.promises.readFile.mockImplementation(path => {
        if (path.includes('fs-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'FS Plugin',
              version: '1.0.0',
              rapid_plugin: { key: 'fs-plugin' },
            }),
          );
        }
        if (path.includes('db-plugin')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'DB Plugin',
              version: '1.0.0',
              rapid_plugin: { key: 'db-plugin' },
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

      const result = await managePlugins(mockContext);

      expect(result).toHaveLength(2);

      const fsPlugin = result.find(p => p.internalId === 'fs-plugin');
      expect(fsPlugin).toBeDefined();
      expect(fsPlugin.isInstalled).toBe(false);

      const dbPlugin = result.find(p => p.key === 'db-plugin');
      expect(dbPlugin).toBeDefined();
      expect(dbPlugin.isActive).toBe(true);
      expect(dbPlugin.source).toBe('db+fs');
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
      expect(missingPlugin.isMissing).toBe(true);
      expect(missingPlugin.source).toBe('db');
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
              rapid_plugin: { key: 'active-p' },
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
    it('should update status and log activity', async () => {
      const mockPlugin = {
        id: 'p1',
        update: jest.fn(),
      };
      mockModels.Plugin.findByPk.mockResolvedValue(mockPlugin);

      await togglePluginStatus('p1', true, mockContext);

      expect(mockPlugin.update).toHaveBeenCalledWith({ is_active: true });
      expect(activityUtils.logPluginActivity).toHaveBeenCalledWith(
        mockWebhook,
        'status_changed',
        'p1',
        { isActive: true },
        'user-123',
      );
    });
  });

  describe('createPlugin', () => {
    it('should create plugin and log activity', async () => {
      const mockPlugin = { id: 'new-p' };
      mockModels.Plugin.create.mockResolvedValue(mockPlugin);

      await createPlugin({ name: 'test' }, mockContext);

      expect(mockModels.Plugin.create).toHaveBeenCalled();
      expect(activityUtils.logPluginActivity).toHaveBeenCalledWith(
        mockWebhook,
        'created',
        'new-p',
        { name: 'test' },
        'user-123',
      );
    });
  });
});
