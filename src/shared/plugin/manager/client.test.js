/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import clientManager from './client';
import {
  ACTIVE_PLUGINS,
  PLUGIN_METADATA,
  INITIALIZED,
  PLUGIN_MANAGER_INIT,
} from './base';

describe('ClientPluginManager', () => {
  let mockContext;

  beforeEach(async () => {
    // Reset singleton state
    clientManager[ACTIVE_PLUGINS].clear();
    clientManager[PLUGIN_METADATA].clear();
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

  describe('CSS Injection', () => {
    it('injects CSS links on plugin:loaded event', async () => {
      const manifest = { cssFiles: ['style.css'] };

      await clientManager.emit('plugin:loaded', { id: 'test-p', manifest });

      const link = document.querySelector('link[rel="stylesheet"]');
      expect(link).toBeTruthy();
      expect(link.href).toContain('/api/plugins/test-p/static/style.css');
      expect(link.getAttribute('data-plugin-id')).toBe('test-p');
    });

    it('removes CSS links on plugin:unloaded event', async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/api/plugins/test-p/static/style.css';
      document.head.appendChild(link);

      await clientManager.emit('plugin:unloaded', { id: 'test-p' });

      expect(document.querySelector('link')).toBeFalsy();
    });
  });

  describe('loadScript', () => {
    it('creates a script tag and waits for load', async () => {
      const loadPromise = clientManager.loadScript('/test.js', 'test-p');

      const script = document.querySelector('script');
      expect(script).toBeTruthy();
      expect(script.src).toContain('/test.js');

      // Manually trigger load event
      script.dispatchEvent(new Event('load'));

      await expect(loadPromise).resolves.toBeUndefined();
    });
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

  describe('handleEvent', () => {
    it('handles PLUGIN_INSTALLED event', async () => {
      const loadPluginSpy = jest
        .spyOn(clientManager, 'loadPlugin')
        .mockResolvedValue({});

      await clientManager.handleEvent({
        type: 'PLUGIN_INSTALLED',
        pluginId: 'new-plugin',
        data: { manifest: { id: 'new-plugin' } },
      });

      expect(loadPluginSpy).toHaveBeenCalledWith(
        'new-plugin',
        expect.any(Object),
      );
      expect(clientManager.needsReload).toBe(true);
    });
  });
});
