/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { computeChecksum } from '../utils/checksum.util.js';

import {
  installExtensionFromPackage,
  deleteExtension,
  toggleExtensionStatus,
} from './extension.service.js';
import {
  recalculateUpdateCount,
  invalidateRegistryCache,
  updateFromHub,
} from './hub.service.js';

jest.mock('./extension.service.js', () => ({
  installExtensionFromPackage: jest.fn(),
  deleteExtension: jest.fn(),
  toggleExtensionStatus: jest.fn(),
  locateExtensionRoot: jest.fn(async dir => dir),
}));

jest.mock('../utils/checksum.util.js', () => ({
  // Keep the real checksumMismatchReason: it is pure, and it is what decides
  // whether a mismatch is reported as tampering or as an unreadable format.
  ...jest.requireActual('../utils/checksum.util.js'),
  computeChecksum: jest.fn(),
}));

/** Checksums must carry the current version tag to be comparable at all. */
const GOOD_CHECKSUM = `v2:${'a'.repeat(64)}`;
const STALE_CHECKSUM = `v2:${'b'.repeat(64)}`;
const ACTUAL_CHECKSUM = `v2:${'c'.repeat(64)}`;

const registry = {
  version: 1,
  extensions: [
    { key: 'k-new', name: '@x/new', version: '2.0.0' },
    { key: 'k-same', name: '@x/same', version: '1.0.0' },
    { key: 'k-dep', name: '@x/dep', version: '9.9.9', deprecated: true },
  ],
};

/** Minimal RBAC model stubs: one role holds extensions:read. */
function rbacModels({ direct = ['admin-1'], viaGroups = [] } = {}) {
  return {
    Role: { findAll: jest.fn(async () => [{ id: 'role-1' }]) },
    Permission: {},
    Group: {},
    User: {
      findAll: jest.fn(async options => {
        const includesGroups = options.include.some(i => i.as === 'groups');
        const ids = includesGroups ? viaGroups : direct;
        return ids.map(id => ({ id }));
      }),
    },
  };
}

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

  function installedModels(extra = {}) {
    return {
      Extension: {
        findAll: jest.fn(async () => [
          { key: 'k-new', version: '1.0.0', is_active: true },
          { key: 'k-same', version: '1.0.0', is_active: true },
          { key: 'k-dep', version: '1.0.0', is_active: false },
          { key: 'k-local-only', version: '1.0.0', is_active: true },
        ]),
      },
      ...extra,
    };
  }

  it('counts installed extensions whose hub version differs, ignoring deprecated ones', async () => {
    const models = installedModels(rbacModels());
    const cache = { set: jest.fn() };
    const ws = {
      sendToProtectedChannel: jest.fn(),
      sendToPrivateChannel: jest.fn(),
    };

    const count = await recalculateUpdateCount({ models, cache, ws });

    expect(count).toBe(1);
    expect(cache.set).toHaveBeenCalledWith('extension_update_count', 1, 86400);
  });

  it('sends the badge only to users holding extensions:read', async () => {
    const models = installedModels(
      rbacModels({ direct: ['admin-1'], viaGroups: ['admin-2'] }),
    );
    const cache = { set: jest.fn() };
    const ws = {
      sendToProtectedChannel: jest.fn(),
      sendToPrivateChannel: jest.fn(),
    };

    await recalculateUpdateCount({ models, cache, ws });

    // The protected channel holds every authenticated socket, so publishing
    // there tells any logged-in user how many updates are pending.
    expect(ws.sendToProtectedChannel).not.toHaveBeenCalled();
    expect(ws.sendToPrivateChannel).toHaveBeenCalledTimes(2);
    expect(ws.sendToPrivateChannel).toHaveBeenCalledWith(
      'admin-1',
      'extension:updates_available',
      { type: 'UPDATES_AVAILABLE_COUNT', count: 1 },
    );
    expect(ws.sendToPrivateChannel).toHaveBeenCalledWith(
      'admin-2',
      'extension:updates_available',
      { type: 'UPDATES_AVAILABLE_COUNT', count: 1 },
    );
  });

  it('sends to nobody when no role grants the permission', async () => {
    const models = installedModels({
      Role: { findAll: jest.fn(async () => []) },
      Permission: {},
      Group: {},
      User: { findAll: jest.fn() },
    });
    const cache = { set: jest.fn() };
    const ws = {
      sendToProtectedChannel: jest.fn(),
      sendToPrivateChannel: jest.fn(),
    };

    const count = await recalculateUpdateCount({ models, cache, ws });

    expect(count).toBe(1);
    expect(ws.sendToPrivateChannel).not.toHaveBeenCalled();
    expect(ws.sendToProtectedChannel).not.toHaveBeenCalled();
  });

  it('fails closed when the RBAC models are unavailable', async () => {
    const models = installedModels();
    const cache = { set: jest.fn() };
    const ws = {
      sendToProtectedChannel: jest.fn(),
      sendToPrivateChannel: jest.fn(),
    };

    await recalculateUpdateCount({ models, cache, ws });

    expect(ws.sendToPrivateChannel).not.toHaveBeenCalled();
    expect(ws.sendToProtectedChannel).not.toHaveBeenCalled();
  });
});

describe('updateFromHub ordering', () => {
  let originalFetch;

  function buildContext({ checksum = GOOD_CHECKSUM } = {}) {
    const existing = {
      key: 'k-up',
      name: '@x/up',
      version: '1.0.0',
      is_active: true,
      toJSON: () => ({ key: 'k-up', name: '@x/up', version: '1.0.0' }),
    };

    return {
      existing,
      context: {
        models: {
          Extension: {
            findOne: jest.fn(async () => existing),
            findOrCreate: jest.fn(async () => [{ update: jest.fn() }, true]),
          },
        },
        extensionManager: {
          resolveExtensionDir: jest.fn(async () => ({ dir: null })),
        },
        cache: { delete: jest.fn() },
        fs: { extract: jest.fn(async () => {}) },
        queue: jest.fn(),
      },
      checksum,
    };
  }

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.XNAPIFY_HUB_REGISTRY_URL = 'https://hub.example/registry.json';
    invalidateRegistryCache();
    computeChecksum.mockResolvedValue(GOOD_CHECKSUM);
    installExtensionFromPackage.mockResolvedValue({ key: 'k-up' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.XNAPIFY_HUB_REGISTRY_URL;
  });

  function mockRegistry(listing) {
    global.fetch = jest.fn(async url => {
      if (String(url).endsWith('registry.json')) {
        return {
          ok: true,
          json: async () => ({ version: 1, extensions: [listing] }),
        };
      }
      // Package download
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
      };
    });
  }

  it('does not delete the installed extension when the registry has no checksum', async () => {
    mockRegistry({
      key: 'k-up',
      name: '@x/up',
      version: '2.0.0',
      downloadUrl: 'https://hub.example/up.zip',
    });
    const { context } = buildContext();

    await expect(updateFromHub('@x/up', context)).rejects.toThrow(
      /no checksum in registry/,
    );

    expect(deleteExtension).not.toHaveBeenCalled();
    expect(toggleExtensionStatus).not.toHaveBeenCalled();
    expect(installExtensionFromPackage).not.toHaveBeenCalled();
  });

  it('does not delete the installed extension when the download fails', async () => {
    global.fetch = jest.fn(async url =>
      String(url).endsWith('registry.json')
        ? {
            ok: true,
            json: async () => ({
              version: 1,
              extensions: [
                {
                  key: 'k-up',
                  name: '@x/up',
                  version: '2.0.0',
                  checksum: GOOD_CHECKSUM,
                  downloadUrl: 'https://hub.example/up.zip',
                },
              ],
            }),
          }
        : { ok: false, status: 503, body: null },
    );
    const { context } = buildContext();

    await expect(updateFromHub('@x/up', context)).rejects.toThrow(
      /Failed to download/,
    );

    expect(deleteExtension).not.toHaveBeenCalled();
  });

  it('does not delete the installed extension when the checksum is stale', async () => {
    mockRegistry({
      key: 'k-up',
      name: '@x/up',
      version: '2.0.0',
      checksum: STALE_CHECKSUM,
      downloadUrl: 'https://hub.example/up.zip',
    });
    const { context } = buildContext();
    computeChecksum.mockResolvedValue(ACTUAL_CHECKSUM);

    await expect(updateFromHub('@x/up', context)).rejects.toThrow(
      /Checksum mismatch/,
    );

    expect(deleteExtension).not.toHaveBeenCalled();
    expect(installExtensionFromPackage).not.toHaveBeenCalled();
  });

  it('deletes and reinstalls once the package verifies', async () => {
    mockRegistry({
      key: 'k-up',
      name: '@x/up',
      version: '2.0.0',
      checksum: GOOD_CHECKSUM,
      downloadUrl: 'https://hub.example/up.zip',
    });
    const { context } = buildContext();

    await updateFromHub('@x/up', context);

    expect(toggleExtensionStatus).toHaveBeenCalledWith('k-up', false, context);
    expect(deleteExtension).toHaveBeenCalledWith('k-up', context);
    expect(installExtensionFromPackage).toHaveBeenCalled();
  });

  it('restores the DB record when the reinstall fails', async () => {
    mockRegistry({
      key: 'k-up',
      name: '@x/up',
      version: '2.0.0',
      checksum: GOOD_CHECKSUM,
      downloadUrl: 'https://hub.example/up.zip',
    });
    const { context } = buildContext();
    installExtensionFromPackage.mockRejectedValue(new Error('disk full'));

    await expect(updateFromHub('@x/up', context)).rejects.toThrow('disk full');

    expect(deleteExtension).toHaveBeenCalled();
    expect(context.models.Extension.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'k-up' } }),
    );
  });
});
