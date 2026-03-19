jest.mock('../workers', () => {
  const pool = {
    computeChecksum: jest.fn().mockResolvedValue('abc123hash'),
    verifyChecksum: jest
      .fn()
      .mockResolvedValue({ valid: true, actual: 'abc123hash' }),
  };
  return { __esModule: true, default: pool };
});

jest.mock('./plugin.helpers', () => ({
  installPluginDependencies: jest.fn().mockResolvedValue(undefined),
  uninstallPluginDependencies: jest.fn().mockResolvedValue(undefined),
  notifyPluginChange: jest.fn(),
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockExistsSync = jest.fn(() => true);
  const mockRm = jest.fn().mockResolvedValue(undefined);

  const mockFs = {
    ...actualFs,
    existsSync: mockExistsSync,
    promises: {
      ...actualFs.promises,
      rm: mockRm,
    },
  };

  return {
    __esModule: true,
    default: mockFs,
    ...mockFs,
  };
});

import fs from 'fs';

import workerPool from '../workers';

import {
  installPluginDependencies,
  uninstallPluginDependencies,
  notifyPluginChange,
} from './plugin.helpers';
import { registerPluginWorkers } from './plugin.workers';

// ── Helpers ──────────────────────────────────────────────

function createMockContainer(overrides = {}) {
  const mockPluginUpdate = jest.fn().mockResolvedValue([1]);
  const mockPluginDestroy = jest.fn().mockResolvedValue(1);
  const mockPluginFindByPk = jest.fn().mockResolvedValue(null);

  const services = {
    models: {
      Plugin: {
        update: mockPluginUpdate,
        destroy: mockPluginDestroy,
        findByPk: mockPluginFindByPk,
      },
    },
    plugin: {
      reloadPlugin: jest.fn().mockResolvedValue(undefined),
      getPluginMetadata: jest.fn(() => null),
      isPluginLoaded: jest.fn(() => false),
      unloadPlugin: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn().mockResolvedValue(undefined),
      getPluginPath: jest.fn(() => '/plugins'),
      getDevPluginPath: jest.fn(() => '/dev-plugins'),
    },
    hook: jest.fn(() => ({ emit: jest.fn() })),
    ws: { sendToPublicChannel: jest.fn() },
    cwd: '/test/cwd',
    queue: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn(),
    })),
    ...overrides,
  };

  return {
    resolve: jest.fn(key => services[key]),
    _services: services,
  };
}

function createMockJob(data = {}) {
  return {
    data: {
      pluginId: 'p1',
      pluginKey: 'test-plugin',
      pluginDir: '/plugins/test-plugin',
      actorId: 'user-1',
      ...data,
    },
    updateProgress: jest.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────

describe('Plugin Workers', () => {
  let handlers;
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContainer = createMockContainer();

    // Capture registered handlers from queueChannel.on()
    handlers = {};
    const mockChannel = {
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
    };
    // eslint-disable-next-line no-underscore-dangle
    mockContainer._services.queue = jest.fn(() => mockChannel);
    // eslint-disable-next-line no-underscore-dangle
    mockContainer.resolve.mockImplementation(
      // eslint-disable-next-line no-underscore-dangle
      key => mockContainer._services[key],
    );

    registerPluginWorkers(mockContainer);
  });

  describe('registerPluginWorkers', () => {
    it('should register install, delete, and toggle handlers', () => {
      expect(handlers.install).toBeDefined();
      expect(handlers.delete).toBeDefined();
      expect(handlers.toggle).toBeDefined();
    });
  });

  describe('install handler', () => {
    it('should install dependencies, compute checksum, and store it', async () => {
      const job = createMockJob();

      const result = await handlers.install(job);

      expect(installPluginDependencies).toHaveBeenCalledWith(
        '/plugins/test-plugin',
        { name: 'test-plugin' },
      );
      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/plugins/test-plugin',
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.models.Plugin.update).toHaveBeenCalledWith(
        { checksum: 'abc123hash' },
        { where: { id: 'p1' } },
      );
      expect(result).toEqual({ success: true });
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should notify via WebSocket on success', async () => {
      const job = createMockJob();

      await handlers.install(job);

      expect(notifyPluginChange).toHaveBeenCalledWith(
        mockContainer,
        'PLUGIN_INSTALLED',
        'p1',
      );
    });

    it('should emit hook on success', async () => {
      const mockEmit = jest.fn();
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.hook = jest.fn(() => ({ emit: mockEmit }));

      const job = createMockJob();
      await handlers.install(job);

      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.hook).toHaveBeenCalledWith(
        'admin:plugins',
      );
      expect(mockEmit).toHaveBeenCalledWith(
        'installed',
        expect.objectContaining({ plugin_id: 'p1' }),
      );
    });

    it('should throw on install failure', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      installPluginDependencies.mockRejectedValueOnce(
        new Error('npm install failed'),
      );

      const job = createMockJob();

      await expect(handlers.install(job)).rejects.toThrow('npm install failed');
    });
  });

  describe('delete handler', () => {
    it('should unload plugin, remove files, and destroy DB record', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.plugin.isPluginLoaded.mockReturnValue(true);
      fs.existsSync.mockReturnValue(true);

      const job = createMockJob();
      const result = await handlers.delete(job);

      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.plugin.unloadPlugin).toHaveBeenCalledWith(
        'p1',
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Plugin.destroy,
      ).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should emit plugin:unloaded when plugin is not loaded', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.plugin.isPluginLoaded.mockReturnValue(false);

      const job = createMockJob();
      await handlers.delete(job);

      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.plugin.emit).toHaveBeenCalledWith(
        'plugin:unloaded',
        { id: 'p1' },
      );
    });

    it('should emit hook on delete', async () => {
      const mockEmit = jest.fn();
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.hook = jest.fn(() => ({ emit: mockEmit }));

      const job = createMockJob();
      await handlers.delete(job);

      expect(mockEmit).toHaveBeenCalledWith(
        'deleted',
        expect.objectContaining({ plugin_id: 'p1' }),
      );
    });
  });

  describe('toggle handler', () => {
    it('should verify checksum before activating non-dev plugins', async () => {
      const mockDbPlugin = {
        checksum: 'expected-hash',
        update: jest.fn(),
      };
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.models.Plugin.findByPk.mockResolvedValue(
        mockDbPlugin,
      );

      workerPool.verifyChecksum.mockResolvedValueOnce({
        valid: true,
        actual: 'expected-hash',
      });

      const job = createMockJob({
        isActive: true,
        isDevPlugin: false,
      });

      const result = await handlers.toggle(job);

      expect(workerPool.verifyChecksum).toHaveBeenCalledWith(
        '/plugins/test-plugin',
        'expected-hash',
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject activation on checksum mismatch', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockDbPlugin = {
        checksum: 'expected-hash',
        update: jest.fn(),
      };
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.models.Plugin.findByPk.mockResolvedValue(
        mockDbPlugin,
      );

      workerPool.verifyChecksum.mockResolvedValueOnce({
        valid: false,
        actual: 'tampered-hash',
      });

      const job = createMockJob({
        isActive: true,
        isDevPlugin: false,
      });

      const result = await handlers.toggle(job);

      expect(result).toEqual({ success: false, reason: 'checksum_mismatch' });
      expect(mockDbPlugin.update).toHaveBeenCalledWith({ is_active: false });
      expect(notifyPluginChange).toHaveBeenCalledWith(
        mockContainer,
        'PLUGIN_TAMPERED',
        'p1',
      );
      spy.mockRestore();
    });

    it('should skip checksum for dev plugins', async () => {
      const job = createMockJob({
        isActive: true,
        isDevPlugin: true,
      });

      await handlers.toggle(job);

      expect(workerPool.verifyChecksum).not.toHaveBeenCalled();
    });

    it('should compute and store checksum after activating', async () => {
      workerPool.computeChecksum.mockResolvedValueOnce('new-hash');

      const job = createMockJob({
        isActive: true,
        isDevPlugin: true,
      });

      await handlers.toggle(job);

      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/plugins/test-plugin',
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.models.Plugin.update).toHaveBeenCalledWith(
        { checksum: 'new-hash' },
        { where: { id: 'p1' } },
      );
    });

    it('should uninstall deps when deactivating', async () => {
      const job = createMockJob({
        isActive: false,
      });

      await handlers.toggle(job);

      expect(uninstallPluginDependencies).toHaveBeenCalledWith(
        '/plugins/test-plugin',
        { name: 'test-plugin' },
      );
    });
  });
});
