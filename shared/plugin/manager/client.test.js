/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import clientManager from './client';
import { INITIALIZED, PLUGIN_MANAGER_INIT } from './base';

describe('ClientPluginManager', () => {
  let mockContext;

  beforeEach(async () => {
    clientManager[INITIALIZED] = false;
    clientManager[PLUGIN_MANAGER_INIT] = null;

    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { plugins: [] } }),
    };

    // Setup minimal browser env
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    // eslint-disable-next-line no-underscore-dangle
    window.__webpack_share_scopes__ = { default: {} };

    await clientManager.init(mockContext);

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeContainer', () => {
    it('initializes MF container with shared scope', async () => {
      const mockContainer = {
        init: jest.fn().mockResolvedValue(true),
      };

      await clientManager.initializeContainer(mockContainer, 'testContainer');

      expect(mockContainer.init).toHaveBeenCalledWith(
        // eslint-disable-next-line no-underscore-dangle
        window.__webpack_share_scopes__.default,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect(mockContainer.__initialized__).toBe(true);
    });
  });

  describe('plugin:loaded hook', () => {
    it('injects CSS link when manifest.hasClientCss is true', async () => {
      await clientManager.emit('plugin:loaded', {
        id: 'test-p',
        manifest: { hasClientCss: true },
      });

      const link = document.querySelector('link[data-plugin-id="test-p"]');
      expect(link).toBeTruthy();
      expect(link.rel).toBe('stylesheet');
      expect(link.href).toContain('/api/plugins/test-p/static/plugin.css');
    });

    it('injects script when manifest.hasClientScript is true', async () => {
      await clientManager.emit('plugin:loaded', {
        id: 'test-p',
        manifest: { hasClientScript: true },
      });

      const script = document.querySelector('script[data-plugin-id="test-p"]');
      expect(script).toBeTruthy();
      expect(script.src).toContain('/api/plugins/test-p/static/remote.js');
    });

    it('skips if manifest is null', async () => {
      await clientManager.emit('plugin:loaded', { id: 'test-p' });

      expect(
        document.querySelector('link[data-plugin-id="test-p"]'),
      ).toBeNull();
      expect(
        document.querySelector('script[data-plugin-id="test-p"]'),
      ).toBeNull();
    });

    it('does not duplicate already present elements', async () => {
      const manifest = { hasClientCss: true, hasClientScript: true };
      await clientManager.emit('plugin:loaded', { id: 'test-p', manifest });
      await clientManager.emit('plugin:loaded', { id: 'test-p', manifest });

      expect(
        document.querySelectorAll('link[data-plugin-id="test-p"]'),
      ).toHaveLength(1);
      expect(
        document.querySelectorAll('script[data-plugin-id="test-p"]'),
      ).toHaveLength(1);
    });
  });

  describe('plugin:unloaded hook', () => {
    it('removes CSS and script tags', async () => {
      // Inject first
      await clientManager.emit('plugin:loaded', {
        id: 'test-p',
        manifest: { hasClientCss: true, hasClientScript: true },
      });

      expect(
        document.querySelector('link[data-plugin-id="test-p"]'),
      ).toBeTruthy();
      expect(
        document.querySelector('script[data-plugin-id="test-p"]'),
      ).toBeTruthy();

      // Then unload
      await clientManager.emit('plugin:unloaded', { id: 'test-p' });

      expect(
        document.querySelector('link[data-plugin-id="test-p"]'),
      ).toBeNull();
      expect(
        document.querySelector('script[data-plugin-id="test-p"]'),
      ).toBeNull();
    });
  });

  describe('handleEvent', () => {
    beforeEach(() => {
      clientManager.needsReload = false;
    });

    it('injects resources and sets needsReload on PLUGIN_INSTALLED', async () => {
      await clientManager.handleEvent({
        type: 'PLUGIN_INSTALLED',
        pluginId: 'new-p',
        data: { manifest: { hasClientCss: true } },
      });

      expect(
        document.querySelector('link[data-plugin-id="new-p"]'),
      ).toBeTruthy();
      expect(clientManager.needsReload).toBe(true);
    });

    it('removes resources and sets needsReload on PLUGIN_UNINSTALLED', async () => {
      // Pre-inject
      await clientManager.emit('plugin:loaded', {
        id: 'old-p',
        manifest: { hasClientCss: true },
      });
      clientManager.needsReload = false;

      await clientManager.handleEvent({
        type: 'PLUGIN_UNINSTALLED',
        pluginId: 'old-p',
      });

      expect(document.querySelector('link[data-plugin-id="old-p"]')).toBeNull();
      expect(clientManager.needsReload).toBe(true);
    });

    it('sets needsReload on PLUGIN_UPDATED', async () => {
      await clientManager.handleEvent({
        type: 'PLUGIN_UPDATED',
        pluginId: 'existing-p',
        data: { manifest: { hasClientScript: true } },
      });

      expect(clientManager.needsReload).toBe(true);
    });

    it('ignores invalid events', async () => {
      await clientManager.handleEvent(null);
      await clientManager.handleEvent({});

      expect(clientManager.needsReload).toBe(false);
    });
  });
});
