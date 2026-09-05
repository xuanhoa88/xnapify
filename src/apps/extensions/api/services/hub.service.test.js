/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  recalculateUpdateCount,
  invalidateRegistryCache,
} from './hub.service.js';

jest.mock('./extension.service.js', () => ({
  installExtensionFromPackage: jest.fn(),
  deleteExtension: jest.fn(),
  toggleExtensionStatus: jest.fn(),
}));

const registry = {
  version: 1,
  extensions: [
    { key: 'k-new', name: '@x/new', version: '2.0.0' },
    { key: 'k-same', name: '@x/same', version: '1.0.0' },
    { key: 'k-dep', name: '@x/dep', version: '9.9.9', deprecated: true },
  ],
};

describe('recalculateUpdateCount', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.XNAPIFY_HUB_REGISTRY_URL = 'https://hub.example/registry.json';
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => registry,
    }));
    invalidateRegistryCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.XNAPIFY_HUB_REGISTRY_URL;
  });

  it('counts installed extensions whose hub version differs, ignoring deprecated ones', async () => {
    const models = {
      Extension: {
        findAll: jest.fn(async () => [
          { key: 'k-new', version: '1.0.0', is_active: true },
          { key: 'k-same', version: '1.0.0', is_active: true },
          { key: 'k-dep', version: '1.0.0', is_active: false },
          { key: 'k-local-only', version: '1.0.0', is_active: true },
        ]),
      },
    };
    const cache = { set: jest.fn() };
    const ws = { sendToProtectedChannel: jest.fn() };

    const count = await recalculateUpdateCount({ models, cache, ws });

    expect(count).toBe(1);
    expect(cache.set).toHaveBeenCalledWith('extension_update_count', 1, 86400);
    expect(ws.sendToProtectedChannel).toHaveBeenCalledWith(
      'extension:updates_available',
      { type: 'UPDATES_AVAILABLE_COUNT', count: 1 },
    );
  });
});
