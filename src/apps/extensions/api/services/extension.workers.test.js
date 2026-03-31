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
  resolveExtension: jest.fn().mockResolvedValue({ extension: null }),
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
    default: mockFs,
    ...mockFs,
  };
});

import workerPool from '../workers';

import {
  installExtensionDependencies,
  notifyExtensionChange,
  resolveExtension,
} from './extension.helpers';
import { registerExtensionWorkers } from './extension.workers';

// ── Helpers ──────────────────────────────────────────────

const TEST_MANIFEST = {
  id: 'test_extension',
  name: 'test-extension',
  version: '1.0.0',
  main: 'api.js',
};

function createMockContainer(overrides = {}) {
  const mockExtensionUpdate = jest.fn().mockResolvedValue([1]);
  const mockExtensionDestroy = jest.fn().mockResolvedValue(1);

  const services = {
    models: {
      Extension: {
        update: mockExtensionUpdate,
        destroy: mockExtensionDestroy,
        findAll: jest.fn().mockResolvedValue([]),
      },
    },
    extension: {
      readManifest: jest.fn().mockResolvedValue(TEST_MANIFEST),
      installExtension: jest.fn().mockResolvedValue(true),
      uninstallExtension: jest.fn().mockResolvedValue(true),
      reloadExtension: jest.fn().mockResolvedValue(undefined),
      loadExtension: jest.fn().mockResolvedValue(undefined),
      getExtensionMetadata: jest.fn(() => ({
        manifest: TEST_MANIFEST,
      })),
      isExtensionLoaded: jest.fn(() => false),
      unloadExtension: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn().mockResolvedValue(undefined),
      getInstalledExtensionsDir: jest.fn(() => '/extensions'),
      getDevExtensionsDir: jest.fn(() => '/dev-extensions'),
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
  let queueHandlers;
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContainer = createMockContainer();

    // Capture registered handlers from queueChannel.on()
    handlers = {};
    queueHandlers = {};
    const mockQueue = {
      on: jest.fn((event, handler) => {
        queueHandlers[event] = handler;
      }),
      getJobs: jest.fn().mockResolvedValue([]),
    };
    const mockChannel = {
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      queue: mockQueue,
    };
    // eslint-disable-next-line no-underscore-dangle
    mockContainer._services.queue = jest.fn(() => mockChannel);
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

  // ── Install ──────────────────────────────────────────

  describe('install handler', () => {
    it('should install deps, compute integrity, and run install hook (no auto-activate)', async () => {
      const job = createMockJob();
      const result = await handlers.install(job);

      // npm install
      expect(installExtensionDependencies).toHaveBeenCalledWith(
        '/extensions/test-extension',
        { name: 'test-extension' },
      );

      // integrity
      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/extensions/test-extension',
      );
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.update,
      ).toHaveBeenCalledWith(
        { integrity: 'abc123hash' },
        { where: { key: 'test-extension' } },
      );

      // install lifecycle
      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle
      expect(em.readManifest).toHaveBeenCalledWith(
        '/extensions/test-extension',
      );
      expect(em.installExtension).toHaveBeenCalledWith(
        'test-extension',
        TEST_MANIFEST,
      );

      // must NOT auto-activate — admin must manually toggle
      expect(em.reloadExtension).not.toHaveBeenCalled();
      expect(em.loadExtension).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        notifyType: 'EXTENSION_INSTALLED',
        extensionKey: 'test-extension',
      });
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should skip install hook if readManifest returns null', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.readManifest.mockResolvedValue(null);

      const job = createMockJob();
      const result = await handlers.install(job);

      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle
      expect(em.installExtension).not.toHaveBeenCalled();
      expect(em.reloadExtension).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
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
        expect.objectContaining({ extension_id: 'test-extension' }),
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

  // ── Delete ───────────────────────────────────────────

  describe('delete handler', () => {
    it('should unload first, then run uninstall hook, and destroy DB', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.isExtensionLoaded.mockReturnValue(true);

      const job = createMockJob();
      const result = await handlers.delete(job);

      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle

      // 1. Unload first (triggers deactivate via event chain)
      expect(em.unloadExtension).toHaveBeenCalledWith('test-extension');

      // 2. Then uninstall lifecycle (one-time teardown — requires non-active state)
      expect(em.getExtensionMetadata).toHaveBeenCalledWith('test-extension');
      expect(em.uninstallExtension).toHaveBeenCalledWith(
        'test-extension',
        TEST_MANIFEST,
      );

      // Verify order: unload before uninstall
      const unloadOrder = em.unloadExtension.mock.invocationCallOrder[0];
      const uninstallOrder = em.uninstallExtension.mock.invocationCallOrder[0];
      expect(unloadOrder).toBeLessThan(uninstallOrder);

      // DB cleanup
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.destroy,
      ).toHaveBeenCalledWith({ where: { key: 'test-extension' } });

      expect(result).toEqual({
        success: true,
        notifyType: 'EXTENSION_UNINSTALLED',
        extensionKey: 'test-extension',
      });
    });

    it('should skip uninstall hook if no manifest in metadata', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.getExtensionMetadata.mockReturnValue(
        null,
      );

      const job = createMockJob();
      await handlers.delete(job);

      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle
      expect(em.uninstallExtension).not.toHaveBeenCalled();
    });

    it('should skip unload if extension is not loaded', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.isExtensionLoaded.mockReturnValue(
        false,
      );

      const job = createMockJob();
      await handlers.delete(job);

      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle
      expect(em.unloadExtension).not.toHaveBeenCalled();
    });

    it('should emit hook on delete', async () => {
      const mockEmit = jest.fn();
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.hook = jest.fn(() => ({ emit: mockEmit }));

      const job = createMockJob();
      await handlers.delete(job);

      expect(mockEmit).toHaveBeenCalledWith(
        'deleted',
        expect.objectContaining({ extension_id: 'test-extension' }),
      );
    });
  });

  // ── Toggle ───────────────────────────────────────────

  describe('toggle handler', () => {
    it('should verify integrity before activating non-dev extensions', async () => {
      const mockDbExtension = {
        integrity: 'expected-hash',
        update: jest.fn(),
      };
      resolveExtension.mockResolvedValueOnce({
        extension: mockDbExtension,
        extensionKey: 'test-extension',
      });

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
      expect(result.success).toBe(true);
    });

    it('should reject activation on integrity mismatch', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockDbExtension = {
        integrity: 'expected-hash',
        update: jest.fn(),
      };
      resolveExtension.mockResolvedValueOnce({
        extension: mockDbExtension,
        extensionKey: 'test-extension',
      });

      workerPool.verifyChecksum.mockResolvedValueOnce({
        valid: false,
        actual: 'tampered-hash',
      });

      const job = createMockJob({
        isActive: true,
        isDevExtension: false,
      });

      const result = await handlers.toggle(job);

      expect(result).toEqual({ success: false, reason: 'integrity_mismatch' });
      expect(mockDbExtension.update).toHaveBeenCalledWith({
        is_active: false,
      });
      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_TAMPERED',
        'test-extension',
      );
      spy.mockRestore();
    });

    it('should skip integrity check for dev extensions', async () => {
      const job = createMockJob({
        isActive: true,
        isDevExtension: true,
      });

      await handlers.toggle(job);

      expect(workerPool.verifyChecksum).not.toHaveBeenCalled();
    });

    it('should compute and store integrity after activating', async () => {
      workerPool.computeChecksum.mockResolvedValueOnce('new-hash');

      const job = createMockJob({
        isActive: true,
        isDevExtension: true,
      });

      await handlers.toggle(job);

      expect(workerPool.computeChecksum).toHaveBeenCalledWith(
        '/extensions/test-extension',
      );
      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.update,
      ).toHaveBeenCalledWith(
        { integrity: 'new-hash' },
        { where: { key: 'test-extension' } },
      );
    });

    it('should unload extension on deactivate', async () => {
      // eslint-disable-next-line no-underscore-dangle
      mockContainer._services.extension.isExtensionLoaded.mockReturnValue(true);

      const job = createMockJob({ isActive: false });

      const result = await handlers.toggle(job);

      const em = mockContainer._services.extension; // eslint-disable-line no-underscore-dangle
      expect(em.unloadExtension).toHaveBeenCalledWith('test-extension');
      expect(result.notifyType).toBe('EXTENSION_DEACTIVATED');
    });
  });

  // ── Queue Lifecycle Events ──────────────────────────────

  describe('queue completed handler', () => {
    it('should register completed and failed handlers on queue adapter', () => {
      expect(queueHandlers.completed).toBeDefined();
      expect(queueHandlers.failed).toBeDefined();
    });

    it('should send WS notification on completed with notifyType', () => {
      const job = { data: { extensionKey: 'test-ext' }, name: 'toggle' };
      const result = {
        success: true,
        notifyType: 'EXTENSION_ACTIVATED',
        extensionKey: 'test-ext',
      };

      queueHandlers.completed(job, result);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_ACTIVATED',
        'test-ext',
      );
    });
  });

  describe('queue failed handler', () => {
    it('should send EXTENSION_ACTIVATE_FAILED on failed activate toggle', async () => {
      const job = {
        data: { extensionKey: 'test-ext', isActive: true },
        name: 'toggle',
      };

      await queueHandlers.failed(job);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_ACTIVATE_FAILED',
        'test-ext',
      );
    });

    it('should send EXTENSION_DEACTIVATE_FAILED on failed deactivate toggle', async () => {
      const job = {
        data: { extensionKey: 'test-ext', isActive: false },
        name: 'toggle',
      };

      await queueHandlers.failed(job);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_DEACTIVATE_FAILED',
        'test-ext',
      );
    });

    it('should send EXTENSION_INSTALL_FAILED on failed install', async () => {
      const job = {
        data: { extensionKey: 'test-ext' },
        name: 'install',
      };

      await queueHandlers.failed(job);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_INSTALL_FAILED',
        'test-ext',
      );
    });

    it('should send EXTENSION_UNINSTALL_FAILED on failed delete', async () => {
      const job = {
        data: { extensionKey: 'test-ext' },
        name: 'delete',
      };

      await queueHandlers.failed(job);

      expect(notifyExtensionChange).toHaveBeenCalledWith(
        mockContainer,
        'EXTENSION_UNINSTALL_FAILED',
        'test-ext',
      );
    });

    it('should revert is_active on failed toggle', async () => {
      const job = {
        data: { extensionKey: 'test-ext', isActive: true },
        name: 'toggle',
      };

      await queueHandlers.failed(job);

      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.update,
      ).toHaveBeenCalledWith(
        { is_active: false },
        { where: { key: 'test-ext' } },
      );
    });

    it('should clean up DB record on failed install', async () => {
      const job = {
        data: { extensionKey: 'test-ext' },
        name: 'install',
      };

      await queueHandlers.failed(job);

      expect(
        // eslint-disable-next-line no-underscore-dangle
        mockContainer._services.models.Extension.destroy,
      ).toHaveBeenCalledWith({ where: { key: 'test-ext' } });
    });
  });

  // ── Queue Assertion ────────────────────────────────────

  describe('queue assertion', () => {
    it('should log error when queueChannel.queue is undefined', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const container = createMockContainer();
      const mockChannelNoQueue = {
        on: jest.fn(),
        queue: null,
      };
      // eslint-disable-next-line no-underscore-dangle
      container._services.queue = jest.fn(() => mockChannelNoQueue);
      container.resolve.mockImplementation(
        // eslint-disable-next-line no-underscore-dangle
        key => container._services[key],
      );

      registerExtensionWorkers(container);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Queue adapter not available'),
      );
      spy.mockRestore();
    });
  });
});
