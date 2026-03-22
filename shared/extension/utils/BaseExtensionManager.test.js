/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

// eslint-disable-next-line no-underscore-dangle
global.__DEV__ = false;

import {
  BaseExtensionManager,
  ExtensionState,
  ACTIVE_EXTENSIONS,
  INITIALIZED,
  EXTENSION_METADATA,
} from './BaseExtensionManager';
import { registry } from './Registry';

// Mock Registry
jest.mock('./Registry', () => ({
  registry: {
    define: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue(true),
    unregister: jest.fn().mockResolvedValue(true),
    getDefinitions: jest.fn(),
    has: jest.fn(),
  },
}));

// Mock i18n utilities used by translations phase
jest.mock('@shared/i18n/utils', () => ({
  addNamespace: jest.fn(),
}));
jest.mock('@shared/i18n/loader', () => ({
  getTranslations: jest.fn(ctx => ctx),
}));

describe('BaseExtensionManager', () => {
  let manager;
  let mockContext;

  beforeEach(() => {
    manager = new BaseExtensionManager();
    mockContext = {
      fetch: jest.fn().mockResolvedValue({ data: { extensions: [] } }),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init', () => {
    it('throws error if context has no fetch', async () => {
      await expect(manager.init({})).rejects.toThrow(
        'ExtensionManager requires a valid context with fetch method',
      );
    });

    it('initializes once and calls fetchAll', async () => {
      const fetchAllSpy = jest.spyOn(manager, 'fetchAll').mockResolvedValue();

      await manager.init(mockContext);
      expect(manager[INITIALIZED]).toBe(true);
      expect(fetchAllSpy).toHaveBeenCalledTimes(1);

      // Second call should skip
      await manager.init(mockContext);
      expect(fetchAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchAll', () => {
    it('fetches extensions and calls loadExtension for each', async () => {
      mockContext.fetch.mockResolvedValue({
        data: {
          extensions: [
            { id: 'extension-1', version: '1.0' },
            'extension-2', // test string format too
          ],
        },
      });

      const loadExtensionSpy = jest
        .spyOn(manager, 'loadExtension')
        .mockResolvedValue();

      await manager.init(mockContext);

      expect(mockContext.fetch).toHaveBeenCalledWith('/api/extensions');
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'extension-1',
        expect.any(Object),
      );
      expect(loadExtensionSpy).toHaveBeenCalledWith('extension-2', null);
    });
  });

  describe('loadExtension', () => {
    it('skips if already loaded', async () => {
      manager[ACTIVE_EXTENSIONS].set('existing', {});
      const result = await manager.loadExtension('existing');
      expect(result).toBeDefined();
      expect(mockContext.fetch).not.toHaveBeenCalled();
    });

    it('successfully loads an extension', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext); // Set context

      mockContext.fetch.mockResolvedValue({
        success: true,
        data: {
          containerName: 'test_container',
          manifest: { id: 'test-extension', main: 'index.js' },
        },
      });

      // Mock resolved entry point
      jest.spyOn(manager, 'resolveEntryPoint').mockReturnValue('index.js');

      const mockExtensionInstance = {
        name: 'Test Extension',
        onLoad: jest.fn(),
      };
      jest
        .spyOn(manager, 'executeExtension')
        .mockResolvedValue(mockExtensionInstance);

      const result = await manager.loadExtension('test-extension');

      expect(result).toBe(mockExtensionInstance);
      expect(registry.define).toHaveBeenCalledWith(
        mockExtensionInstance,
        mockContext,
        { id: 'test-extension', main: 'index.js' },
      );
      expect(mockExtensionInstance.onLoad).toHaveBeenCalledWith(mockContext);

      const meta = manager[EXTENSION_METADATA].get('test-extension');
      expect(meta.state).toBe(ExtensionState.LOADED);
    });

    it('handles load failure', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      mockContext.fetch.mockResolvedValue({
        success: false,
        message: 'Not found',
      });

      await manager.loadExtension('fail-extension');

      const meta = manager[EXTENSION_METADATA].get('fail-extension');
      expect(meta.state).toBe(ExtensionState.FAILED);
      expect(meta.error.message).toBe('Not found');
    });
  });

  describe('loadDependencies', () => {
    it('skips loading if all dependencies are already active', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      manager[ACTIVE_EXTENSIONS].set('dep-1', {});
      const loadExtensionSpy = jest.spyOn(manager, 'loadExtension');

      await manager.loadDependencies('extension-1', { 'dep-1': '^1.0.0' });

      expect(loadExtensionSpy).not.toHaveBeenCalled();
    });

    it('loads missing dependencies in parallel', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      manager[ACTIVE_EXTENSIONS].set('existing-dep', {});
      const loadExtensionSpy = jest
        .spyOn(manager, 'loadExtension')
        .mockResolvedValue({});

      await manager.loadDependencies('extension-1', {
        'existing-dep': '^1.0.0',
        'missing-dep-1': '^2.0.0',
        'missing-dep-2': '^3.0.0',
      });

      expect(loadExtensionSpy).toHaveBeenCalledTimes(2);
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'missing-dep-1',
        undefined,
        expect.any(Set),
      );
      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'missing-dep-2',
        undefined,
        expect.any(Set),
      );
    });
  });

  describe('unloadExtension', () => {
    it('unregisters extension from registry', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      const mockExtension = { onUnload: jest.fn() };
      manager[ACTIVE_EXTENSIONS].set('p1', mockExtension);
      manager[EXTENSION_METADATA].set('p1', { state: ExtensionState.LOADED });

      await manager.unloadExtension('p1');

      expect(mockExtension.onUnload).toHaveBeenCalledWith(mockContext);
      expect(registry.unregister).toHaveBeenCalledWith('p1', mockContext);
      expect(manager[ACTIVE_EXTENSIONS].has('p1')).toBe(false);
      expect(manager[EXTENSION_METADATA].get('p1').state).toBe(
        ExtensionState.UNLOADED,
      );
    });
  });

  describe('loadNamespace', () => {
    it('activates extensions for a namespace', async () => {
      manager[INITIALIZED] = true;
      manager.init(mockContext);

      const mockDef = { id: 'p1', init: jest.fn() };
      registry.getDefinitions.mockReturnValue(new Set([mockDef]));

      await manager.loadNamespace('ui');

      expect(registry.register).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ id: 'p1' }),
      );
      expect(manager[ACTIVE_EXTENSIONS].has('p1')).toBe(true);

      // Verify init wrapper
      const registeredInstance = registry.register.mock.calls[0][1];
      await registeredInstance.init(registry);
      expect(mockDef.init).toHaveBeenCalledWith(registry, mockContext);
    });
  });
});
