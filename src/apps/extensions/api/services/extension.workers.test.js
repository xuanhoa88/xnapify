jest.mock('../workers', () => {
  const pool = {
    computeChecksum: jest.fn().mockResolvedValue('abc123hash'),
    verifyChecksum: jest
      .fn()
      .mockResolvedValue({ valid: true, actual: 'abc123hash' }),
  };
  return { __esModule: true, default: pool };
});

jest.mock('./extension.helpers', () => ({
  installExtensionDependencies: jest.fn().mockResolvedValue(undefined),
  notifyExtensionChange: jest.fn(),
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
  installExtensionDependencies,
  notifyExtensionChange,
} from './extension.helpers';
import { registerExtensionWorkers } from './extension.workers';

// ── Helpers ──────────────────────────────────────────────

function createMockContainer(overrides = {}) {
  const mockExtensionUpdate = jest.fn().mockResolvedValue([1]);
  const mockExtensionDestroy = jest.fn().mockResolvedValue(1);
  const mockExtensionFindByPk = jest.fn().mockResolvedValue(null);

  const services = {
    models: {
      Extension: {
        update: mockExtensionUpdate,
        destroy: mockExtensionDestroy,
        findByPk: mockExtensionFindByPk,
      },
    },
    extension: {
      reloadExtension: jest.fn().mockResolvedValue(undefined),
      getExtensionMetadata: jest.fn(() => null),
      isExtensionLoaded: jest.fn(() => false),
      unloadExtension: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn().mockResolvedValue(undefined),
      getInstalledExtensionsDir: jest.fn(() => '/extensions'),
      getDevExtensionPath: jest.fn(() => '/dev-extensions'),
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
      extensionId: 'p1',
      extensionKey: 'test-extension',
      extensionDir: '/extensions/test-extension',
      actorId: 'user-1',
      ...data,
    },
    updateProgress: jest.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────

describe('Extension Workers', () => {
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

    registerExtensionWorkers(mockContainer);
  });

  describe('registerExtensionWorkers', () => {
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

      expect(installExtensionDependencies).toHaveBeenCalledWith(
        '/extensions/test-extension',
        { name: 'test-extension' },
      );
      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/extensions/test-extension',
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.update,
      ).toHaveBeenCalledWith(
        { checksum: 'abc123hash' },
        { where: { id: 'p1' } },
      );
      expect(result).toEqual({ success: true });
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should notify via WebSocket on success', async () => {
      const job = createMockJob();

      await handlers.install(job);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_INSTALLED',
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
        'admin:extensions',
      );
      expect(mockEmit).toHaveBeenCalledWith(
        'installed',
        expect.objectContaining({ extension_id: 'p1' }),
      );
    });

    it('should throw on install failure', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      installExtensionDependencies.mockRejectedValueOnce(
        new Error('npm install failed'),
      );

      const job = createMockJob();

      await expect(handlers.install(job)).rejects.toThrow('npm install failed');
    });
  });

  describe('delete handler', () => {
    it('should unload extension, remove files, and destroy DB record', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.isExtensionLoaded.mockReturnValue(true);
      fs.existsSync.mockReturnValue(true);

      const job = createMockJob();
      const result = await handlers.delete(job);

      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.extension.unloadExtension,
      ).toHaveBeenCalledWith('p1');
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.destroy,
      ).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should emit extension:unloaded when extension is not loaded', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.isExtensionLoaded.mockReturnValue(
        false,
      );

      const job = createMockJob();
      await handlers.delete(job);

      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer._services.extension.emit).toHaveBeenCalledWith(
        'extension:unloaded',
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
        expect.objectContaining({ extension_id: 'p1' }),
      );
    });
  });

  describe('toggle handler', () => {
    it('should verify checksum before activating non-dev extensions', async () => {
      const mockDbExtension = {
        checksum: 'expected-hash',
        update: jest.fn(),
      };
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.models.Extension.findByPk.mockResolvedValue(
        mockDbExtension,
      );

      workerPool.verifyChecksum.mockResolvedValueOnce({
        valid: true,
        actual: 'expected-hash',
      });

      const job = createMockJob({
        isActive: true,
        isDevExtension: false,
      });

      const result = await handlers.toggle(job);

      expect(workerPool.verifyChecksum).toHaveBeenCalledWith(
        '/extensions/test-extension',
        'expected-hash',
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject activation on checksum mismatch', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockDbExtension = {
        checksum: 'expected-hash',
        update: jest.fn(),
      };
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.models.Extension.findByPk.mockResolvedValue(
        mockDbExtension,
      );

      workerPool.verifyChecksum.mockResolvedValueOnce({
        valid: false,
        actual: 'tampered-hash',
      });

      const job = createMockJob({
        isActive: true,
        isDevExtension: false,
      });

      const result = await handlers.toggle(job);

      expect(result).toEqual({ success: false, reason: 'checksum_mismatch' });
      expect(mockDbExtension.update).toHaveBeenCalledWith({ is_active: false });
      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_TAMPERED',
        'p1',
      );
      spy.mockRestore();
    });

    it('should skip checksum for dev extensions', async () => {
      const job = createMockJob({
        isActive: true,
        isDevExtension: true,
      });

      await handlers.toggle(job);

      expect(workerPool.verifyChecksum).not.toHaveBeenCalled();
    });

    it('should compute and store checksum after activating', async () => {
      workerPool.computeChecksum.mockResolvedValueOnce('new-hash');

      const job = createMockJob({
        isActive: true,
        isDevExtension: true,
      });

      await handlers.toggle(job);

      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/extensions/test-extension',
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.update,
      ).toHaveBeenCalledWith({ checksum: 'new-hash' }, { where: { id: 'p1' } });
    });
  });
});
