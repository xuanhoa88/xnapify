/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 *
 * @jest-environment jsdom
 */

/* global jest */

import { ACTIVE_EXTENSIONS } from '../utils/BaseExtensionManager.js';

import clientManager from './ExtensionManager.js';

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

    it('uses hashed CSS filename from buildManifest', async () => {
      await clientManager.emit('extension:loaded', {
        id: 'test-hash',
        manifest: {
          hasClientCss: true,
          buildManifest: { 'extension.css': 'extension.abc12345.css' },
        },
      });

      const link = document.querySelector(
        'link[data-extension-id="test-hash"]',
      );
      expect(link).toBeTruthy();
      expect(link.href).toContain(
        '/api/extensions/test-hash/static/extension.abc12345.css',
      );
    });

    it('uses hashed script filename from buildManifest', async () => {
      await clientManager.emit('extension:loaded', {
        id: 'test-hash',
        manifest: {
          hasClientScript: true,
          buildManifest: { 'remote.js': 'remote.def67890.js' },
        },
      });

      const script = document.querySelector(
        'script[data-extension-id="test-hash"]',
      );
      expect(script).toBeTruthy();
      expect(script.src).toContain(
        '/api/extensions/test-hash/static/remote.def67890.js',
      );
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

  describe('sidebar menus across activation', () => {
    /**
     * Walks the real activate/deactivate path a WebSocket event takes:
     * processLifecycleEvent → loadExtension → _postLoad →
     * _activateViewExtension → def.menus(...). Only the Module Federation
     * fetch of the remote bundle is stubbed.
     */
    let store;
    let ext;

    beforeEach(() => {
      store = { dispatch: jest.fn(), getState: () => ({}) };
      clientManager.viewContext = {
        store,
        i18n: { t: (_k, fallback) => fallback },
      };

      ext = {
        menus: jest.fn(({ store: s2, i18n }) =>
          s2.dispatch({ type: 'ui/registerMenu', label: i18n.t('x', 'Posts') }),
        ),
        shutdown: jest.fn(({ store: s2 }) =>
          s2.dispatch({ type: 'ui/unregisterMenu' }),
        ),
      };

      jest.spyOn(clientManager, '_loadExtensionModule').mockResolvedValue(ext);
    });

    afterEach(async () => {
      clientManager.viewContext = null;
      clientManager[ACTIVE_EXTENSIONS].delete('menu-plugin');
    });

    const MANIFEST = {
      id: 'menu-plugin',
      name: '@xnapify-extension/menu',
      version: '1.0.0',
      hasClientScript: true,
      slots: ['*'],
    };

    it('registers the sidebar entry when the extension is activated', async () => {
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_ACTIVATED',
        extensionId: 'menu-plugin',
        data: { manifest: MANIFEST },
      });

      expect(ext.menus).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ui/registerMenu', label: 'Posts' }),
      );
    });

    it('removes the sidebar entry when the extension is deactivated', async () => {
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_ACTIVATED',
        extensionId: 'menu-plugin',
        data: { manifest: MANIFEST },
      });
      store.dispatch.mockClear();

      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_DEACTIVATED',
        extensionId: 'menu-plugin',
      });

      expect(ext.shutdown).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ui/unregisterMenu' }),
      );
    });
  });

  describe('re-activation after deactivation', () => {
    it('re-registers the sidebar entry when toggled off and on again', async () => {
      const store = { dispatch: jest.fn(), getState: () => ({}) };
      clientManager.viewContext = {
        store,
        i18n: { t: (_k, fallback) => fallback },
      };
      const ext = {
        menus: jest.fn(({ store: s2 }) =>
          s2.dispatch({ type: 'ui/registerMenu' }),
        ),
        shutdown: jest.fn(),
      };
      jest.spyOn(clientManager, '_loadExtensionModule').mockResolvedValue(ext);

      const manifest = {
        id: 'toggle-plugin',
        name: '@xnapify-extension/toggle',
        version: '1.0.0',
        hasClientScript: true,
        slots: ['*'],
      };
      const activate = () =>
        clientManager.processLifecycleEvent({
          type: 'EXTENSION_ACTIVATED',
          extensionId: 'toggle-plugin',
          data: { manifest },
        });

      await activate();
      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_DEACTIVATED',
        extensionId: 'toggle-plugin',
      });
      await activate();

      // The operator flipped the switch off and back on; the entry has to
      // come back, which means the second activation must run menus again.
      expect(ext.menus).toHaveBeenCalledTimes(2);

      clientManager.viewContext = null;
      clientManager[ACTIVE_EXTENSIONS].delete('toggle-plugin');
    });
  });

  describe('a deactivated extension stays deactivated', () => {
    it('is not resurrected by the next navigation', async () => {
      const store = { dispatch: jest.fn(), getState: () => ({}) };
      clientManager.viewContext = {
        store,
        i18n: { t: (_k, fallback) => fallback },
      };
      const ext = {
        menus: jest.fn(({ store: s2 }) =>
          s2.dispatch({ type: 'ui/registerMenu' }),
        ),
        shutdown: jest.fn(({ store: s2 }) =>
          s2.dispatch({ type: 'ui/unregisterMenu' }),
        ),
        // Module-type: no explicit slots, so the registry files it under '*'.
        routes: () => ({ files: () => [], load: () => ({}) }),
      };
      jest.spyOn(clientManager, '_loadExtensionModule').mockResolvedValue(ext);

      await clientManager.sync([
        {
          id: 'posts',
          name: '@xnapify-extension/posts',
          version: '1.0.0',
          hasClientScript: true,
        },
      ]);
      expect(ext.menus).toHaveBeenCalledTimes(1);

      await clientManager.processLifecycleEvent({
        type: 'EXTENSION_DEACTIVATED',
        extensionId: 'posts',
      });
      expect(ext.shutdown).toHaveBeenCalledTimes(1);

      // The operator navigates. onRouteInit activates the route's namespace,
      // and getDefinitions() merges the '*' subscribers into every namespace.
      await clientManager.ensureViewNamespaceActive('users');

      expect(ext.menus).toHaveBeenCalledTimes(1);

      clientManager.viewContext = null;
      clientManager[ACTIVE_EXTENSIONS].delete('posts');
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

  // ---------------------------------------------------------------------------
  // Deferred slot-only extensions
  // ---------------------------------------------------------------------------

  describe('deferred extensions', () => {
    const slotOnly = {
      name: 'quick-access',
      id: 'quick',
      hasRoutes: false,
      hasClientCss: true,
      hasClientScript: true,
      slots: ['login'],
    };

    it('parks a slot-only extension instead of loading it', async () => {
      const load = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'loadExtension',
        )
        .mockResolvedValue({});

      const result = await clientManager.loadExtension('quick', slotOnly);

      expect(result).toBeNull();
      expect(load).not.toHaveBeenCalled();
    });

    it('loads it, and waits for its stylesheet, when its namespace activates', async () => {
      const order = [];
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'loadExtension',
        )
        .mockImplementation(async () => {
          order.push('load');
          return {};
        });
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'activateViewNamespace',
        )
        .mockImplementation(async () => {
          order.push('activate');
        });
      jest

        .spyOn(clientManager, '_settleStylesheet')
        .mockImplementation(async () => {
          order.push('stylesheet');
        });

      await clientManager.loadExtension('quick', slotOnly);
      await clientManager.activateViewNamespace('login');

      // The slot is rendered by whoever awaited activation, so the stylesheet
      // has to be settled before that returns.
      expect(order).toEqual(['load', 'stylesheet', 'activate']);
    });

    it('leaves a deferred extension parked for an unrelated namespace', async () => {
      const load = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'loadExtension',
        )
        .mockResolvedValue({});
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'activateViewNamespace',
        )
        .mockResolvedValue(undefined);

      await clientManager.loadExtension('quick', slotOnly);
      await clientManager.activateViewNamespace('/admin/users');

      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('_loadScript', () => {
    it('gives up on a server-emitted tag that already failed', async () => {
      // The server now emits <script defer data-extension-id> for a deferred
      // extension on the page that renders its slots. Defer scripts have all
      // run by the time parsing ends, so if the container is still missing
      // the fetch failed and its error event fired before anyone listened.
      // Waiting for a second one would hang the resolve that renders the page.
      const script = document.createElement('script');
      script.src = '/api/extensions/quick/static/remote.js';
      script.setAttribute('data-extension-id', 'quick');
      document.body.appendChild(script);

      await expect(
        // eslint-disable-next-line no-underscore-dangle
        clientManager._loadScript(
          '/api/extensions/quick/static/remote.js',
          'quick',
        ),
      ).rejects.toMatchObject({ code: 'SCRIPT_LOAD_FAILED' });
    });

    it('still waits on a tag it injected itself', async () => {
      // eslint-disable-next-line no-underscore-dangle
      const pending = clientManager._loadScript('/x/remote.js', 'own');
      const script = document.querySelector('script[data-extension-id="own"]');

      expect(script).not.toBeNull();
      expect(script.getAttribute('data-extension-injected')).toBe('true');

      script.dispatchEvent(new Event('load'));
      await expect(pending).resolves.toBeUndefined();
    });

    it('resolves at once for a tag already marked loaded', async () => {
      const script = document.createElement('script');
      script.setAttribute('data-extension-id', 'done');
      script.setAttribute('data-loaded', 'true');
      document.body.appendChild(script);

      await expect(
        // eslint-disable-next-line no-underscore-dangle
        clientManager._loadScript('/x/remote.js', 'done'),
      ).resolves.toBeUndefined();
    });
  });

  describe('_settleStylesheet', () => {
    it('resolves at once when the page carries no such stylesheet', async () => {
      await expect(
        // eslint-disable-next-line no-underscore-dangle
        clientManager._settleStylesheet('nope'),
      ).resolves.toBeUndefined();
    });

    it('resolves when the link finishes loading', async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-extension-id', 'quick');
      document.head.appendChild(link);

      // eslint-disable-next-line no-underscore-dangle
      const settled = clientManager._settleStylesheet('quick');
      link.dispatchEvent(new Event('load'));

      await expect(settled).resolves.toBeUndefined();
    });

    it('gives up at once on a link whose error already fired', async () => {
      // The injector marks a failed sheet. Without that mark the error event
      // is long gone by the time anyone listens, so the first navigation to a
      // page hosting the extension burned the full timeout.
      jest.useFakeTimers();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-extension-id', 'quick');
      link.setAttribute('data-extension-css-error', 'true');
      document.head.appendChild(link);

      let settled = false;
      // eslint-disable-next-line no-underscore-dangle
      const pending = clientManager._settleStylesheet('quick').then(() => {
        settled = true;
      });

      // No timers advanced: nothing may be waiting on one.
      await pending;
      expect(settled).toBe(true);
      jest.useRealTimers();
    });

    it('marks and logs a link that fails while it waits', async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-extension-id', 'quick');
      document.head.appendChild(link);

      // eslint-disable-next-line no-underscore-dangle
      const settled = clientManager._settleStylesheet('quick');
      link.dispatchEvent(new Event('error'));

      await expect(settled).resolves.toBeUndefined();
      expect(link.getAttribute('data-extension-css-error')).toBe('true');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load stylesheet'),
      );
    });

    it('marks the link when the injected stylesheet errors', async () => {
      await clientManager.emit('extension:loaded', {
        id: 'quick',
        manifest: { hasClientCss: true },
      });

      const link = document.querySelector('link[data-extension-id="quick"]');
      link.dispatchEvent(new Event('error'));

      expect(link.getAttribute('data-extension-css-error')).toBe('true');

      await expect(
        // eslint-disable-next-line no-underscore-dangle
        clientManager._settleStylesheet('quick'),
      ).resolves.toBeUndefined();
    });

    it('gives up rather than holding a navigation open', async () => {
      jest.useFakeTimers();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-extension-id', 'quick');
      document.head.appendChild(link);

      // eslint-disable-next-line no-underscore-dangle
      const settled = clientManager._settleStylesheet('quick', 50);
      jest.advanceTimersByTime(50);

      await expect(settled).resolves.toBeUndefined();
      jest.useRealTimers();
    });
  });

  // Runs last: destroy() clears the singleton's own event subscriptions.
  describe('destroy', () => {
    it('forgets parked manifests so they cannot be resurrected', async () => {
      const slotOnly = {
        name: 'quick-access',
        id: 'quick',
        hasRoutes: false,
        slots: ['login'],
      };

      await clientManager.loadExtension('quick', slotOnly);
      await clientManager.destroy();

      const load = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'loadExtension',
        )
        .mockResolvedValue({});
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(clientManager)),
          'activateViewNamespace',
        )
        .mockResolvedValue(undefined);

      await clientManager.activateViewNamespace('login');

      expect(load).not.toHaveBeenCalled();
    });
  });
});
