/**
 * @jest-environment jsdom
 */

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import { ACTIVE_EXTENSIONS } from '../utils/BaseExtensionManager';

import clientManager from './ExtensionManager';

describe('ClientExtensionManager', () => {
  let mockContext;

  beforeEach(async () => {
    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };

    // Setup minimal browser env
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    // eslint-disable-next-line no-underscore-dangle
    window.__webpack_share_scopes__ = { default: {} };

    clientManager.fetch = mockContext.fetch;

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('_initializeContainer', () => {
    it('initializes MF container with shared scope', async () => {
      const mockContainer = {
        init: jest.fn().mockResolvedValue(true),
      };

      // eslint-disable-next-line no-underscore-dangle
      await clientManager._initializeContainer(mockContainer, 'testContainer');

      expect(mockContainer.init).toHaveBeenCalledWith(
        // eslint-disable-next-line no-underscore-dangle
        window.__webpack_share_scopes__.default,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer.__initialized__).toBe(true);
    });
  });

  describe('extension:loaded hook', () => {
    it('injects CSS link when manifest.hasClientCss is true', async () => {
      await clientManager.emit('extension:loaded', {
        id: 'test-p',
        manifest: { hasClientCss: true },
      });

      const link = document.querySelector('link[data-extension-id="test-p"]');
      expect(link).toBeTruthy();
      expect(link.rel).toBe('stylesheet');
      expect(link.href).toContain(
        '/api/extensions/test-p/static/extension.css',
      );
    });

    it('injects script when manifest.hasClientScript is true', async () => {
      await clientManager.emit('extension:loaded', {
        id: 'test-p',
        manifest: { hasClientScript: true },
      });

      const script = document.querySelector(
        'script[data-extension-id="test-p"]',
      );
      expect(script).toBeTruthy();
      expect(script.src).toContain('/api/extensions/test-p/static/remote.js');
    });

    it('skips if manifest is null', async () => {
      await clientManager.emit('extension:loaded', { id: 'test-p' });

      expect(
        document.querySelector('link[data-extension-id="test-p"]'),
      ).toBeNull();
      expect(
        document.querySelector('script[data-extension-id="test-p"]'),
      ).toBeNull();
    });

    it('does not duplicate already present elements', async () => {
      const manifest = { hasClientCss: true, hasClientScript: true };
      await clientManager.emit('extension:loaded', { id: 'test-p', manifest });
      await clientManager.emit('extension:loaded', { id: 'test-p', manifest });

      expect(
        document.querySelectorAll('link[data-extension-id="test-p"]'),
      ).toHaveLength(1);
      expect(
        document.querySelectorAll('script[data-extension-id="test-p"]'),
      ).toHaveLength(1);
    });
  });

  describe('extension:unloaded hook', () => {
    it('removes CSS and script tags', async () => {
      // Inject first
      await clientManager.emit('extension:loaded', {
        id: 'test-p',
        manifest: { hasClientCss: true, hasClientScript: true },
      });

      expect(
        document.querySelector('link[data-extension-id="test-p"]'),
      ).toBeTruthy();
      expect(
        document.querySelector('script[data-extension-id="test-p"]'),
      ).toBeTruthy();

      // Then unload
      await clientManager.emit('extension:unloaded', { id: 'test-p' });

      expect(
        document.querySelector('link[data-extension-id="test-p"]'),
      ).toBeNull();
      expect(
        document.querySelector('script[data-extension-id="test-p"]'),
      ).toBeNull();
    });
  });

  describe('processLifecycleEvent', () => {
    let loadSpy;
    let unloadSpy;
    let reloadSpy;

    beforeEach(() => {
      loadSpy = jest
        .spyOn(clientManager, 'loadExtension')
        .mockResolvedValue(undefined);
      unloadSpy = jest
        .spyOn(clientManager, 'unloadExtension')
        .mockResolvedValue(undefined);
      reloadSpy = jest
        .spyOn(clientManager, 'reloadExtension')
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      loadSpy.mockRestore();
      unloadSpy.mockRestore();
      reloadSpy.mockRestore();
    });

    it('injects resources and reloads on EXTENSION_INSTALLED', async () => {
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_INSTALLED',
        extensionId: 'new-p',
        data: { manifest: { hasClientCss: true } },
      });

      // CSS injection happens inside loadExtension → emit('extension:loaded'),
      // not directly in processLifecycleEvent. Here we verify the reload call.
      expect(reloadSpy).toHaveBeenCalledWith('new-p');
    });

    it('unloads and removes resources on EXTENSION_UNINSTALLED', async () => {
      // Mark as loaded so unload path is taken
      jest.spyOn(clientManager, 'isExtensionLoaded').mockReturnValue(true);

      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_UNINSTALLED',
        extensionId: 'old-p',
      });

      // Unload is called via _teardownExtension; DOM cleanup happens
      // inside unloadExtension → emit('extension:unloaded') handler.
      expect(unloadSpy).toHaveBeenCalledWith('old-p');
    });

    it('reloads extension on EXTENSION_UPDATED', async () => {
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_UPDATED',
        extensionId: 'existing-p',
        data: { manifest: { hasClientScript: true } },
      });

      expect(reloadSpy).toHaveBeenCalledWith('existing-p');
    });

    it('loads extension on EXTENSION_ACTIVATED', async () => {
      const manifest = { hasClientCss: true };
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_ACTIVATED',
        extensionId: 'activated-p',
        data: { manifest },
      });

      expect(loadSpy).toHaveBeenCalledWith('activated-p', manifest);
    });

    it('unloads extension on EXTENSION_DEACTIVATED', async () => {
      jest.spyOn(clientManager, 'isExtensionLoaded').mockReturnValue(true);

      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_DEACTIVATED',
        extensionId: 'deactivated-p',
      });

      expect(unloadSpy).toHaveBeenCalledWith('deactivated-p');
    });

    it('ignores invalid events', async () => {
      await clientManager.processLifecycleEvent(null);
      await clientManager.processLifecycleEvent({});

      expect(loadSpy).not.toHaveBeenCalled();
      expect(unloadSpy).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('route injection', () => {
    let mockRouter;

    beforeEach(() => {
      mockRouter = {
        add: jest.fn().mockReturnValue([]),
        remove: jest.fn().mockReturnValue(true),
      };
    });

    it('connectViewRouter injects buffered view adapters', () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Simulate buffered injection (no router available yet)
      // eslint-disable-next-line no-underscore-dangle
      clientManager._injectRoutes('test-ext', mockAdapter);

      // Flush with router
      clientManager.connectViewRouter(mockRouter);

      expect(mockRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );
    });

    it('connectViewRouter re-injects stored adapters on subsequent flush', async () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // First flush stores the adapter
      // eslint-disable-next-line no-underscore-dangle
      await clientManager._injectRoutes('test-ext', mockAdapter);
      clientManager.connectViewRouter(mockRouter);
      expect(mockRouter.add).toHaveBeenCalledTimes(1);

      // Second flush (e.g. SSR creates new router per request)
      const newRouter = {
        add: jest.fn(() => []),
        remove: jest.fn(),
      };
      clientManager.connectViewRouter(newRouter);

      expect(newRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );
    });

    it('connectViewRouter stores router reference for later _injectRoutes', async () => {
      // Flush first to store router
      clientManager.connectViewRouter(mockRouter);

      // Subsequent _injectRoutes should use stored reference
      const mockAdapter = { files: () => [], load: () => ({}) };
      // eslint-disable-next-line no-underscore-dangle
      await clientManager._injectRoutes('test-ext', mockAdapter);

      expect(mockRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );
    });

    it('_injectRoutes injects directly when router is available', async () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Store router reference via flush (simulates bootstrapViews)
      clientManager.connectViewRouter(mockRouter);

      // eslint-disable-next-line no-underscore-dangle
      await clientManager._injectRoutes('test-ext', mockAdapter);

      expect(mockRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );
    });

    it('_teardownExtension removes route adapters and unloads', async () => {
      const mockAdapter = { files: () => [], load: () => ({}) };

      // Store router reference via flush
      clientManager.connectViewRouter(mockRouter);

      // Mark extension as loaded (teardown resolves via ACTIVE_EXTENSIONS)
      clientManager[ACTIVE_EXTENSIONS].set('test-ext', {});

      // Inject routes first
      // eslint-disable-next-line no-underscore-dangle
      await clientManager._injectRoutes('test-ext', mockAdapter);
      expect(mockRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );

      // Trigger teardown (called by DEACTIVATED/UNINSTALLED handlers)
      // eslint-disable-next-line no-underscore-dangle
      await clientManager._teardownExtension('test-ext');

      expect(mockRouter.remove).toHaveBeenCalledWith('test-ext', undefined);
    });

    it('end-to-end: loadExtension injects view routes automatically', async () => {
      const mockAdapter = { files: () => [], load: () => ({}) };
      const mockManifest = {
        name: 'test-ext',
        id: 'test_ext',
        main: 'remoteEntry.js',
        browser: 'remoteEntry.js',
        hasClientScript: true,
      };

      // Mock the module returned from the container
      const mockModule = {
        routes: () => mockAdapter,
      };

      // Store router reference via flush
      clientManager.connectViewRouter(mockRouter);

      // Mock the container loading process
      jest.spyOn(clientManager, '_loadScript').mockResolvedValue();
      jest.spyOn(clientManager, '_initializeContainer').mockResolvedValue();
      jest
        .spyOn(clientManager, '_getContainerModule')
        .mockResolvedValue(mockModule);

      // Set global container (MF container name = extension_<id>)
      window.extension_test_ext = {};

      // Mock fetch for loadExtension — API returns { manifest } (no containerName)
      clientManager.fetch = jest.fn().mockResolvedValue({
        success: true,
        data: { manifest: mockManifest },
      });

      // Bootstrap the extension via loadExtension (view lifecycle now runs here)
      await clientManager.loadExtension('test-ext', mockManifest);

      // Verify that the views function was called and the adapter injected
      expect(mockRouter.add).toHaveBeenCalledWith(
        mockAdapter,
        undefined,
        'test-ext',
      );
    });
  });
});
