/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// The build toolchain around this module is ESM-only and is not transformed
// for jest. None of it participates in the behaviour under test.
jest.mock('@rspack/core', () => ({
  rspack: new Proxy({}, { get: () => class Stub {} }),
}));
jest.mock('../factories/postcss.factory.js', () => ({
  __esModule: true,
  default: () => ({ plugins: [] }),
}));
jest.mock('rspack-merge', () => {
  const isPlain = value =>
    value && typeof value === 'object' && !Array.isArray(value);
  const deep = (a, b) => {
    const out = { ...a };
    for (const [key, value] of Object.entries(b || {})) {
      out[key] =
        isPlain(value) && isPlain(a?.[key]) ? deep(a[key], value) : value;
    }
    return out;
  };
  const merge = (...configs) => configs.reduce((acc, c) => deep(acc, c), {});
  return { __esModule: true, default: merge, merge };
});

/** Import base.config.js fresh under a given NODE_ENV. */
async function loadWithEnv(nodeEnv) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  jest.resetModules();
  try {
    return await import('./base.config.js');
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('persistent cache', () => {
  // Persistent cache is opt-in (RSPACK_PERSISTENT_CACHE=true). It aborts the
  // process when two transactions share a storage directory, and `npm run dev`
  // runs 14+ concurrent compilers, so it cannot default to on.
  const withOptIn = fn => async () => {
    const previous = process.env.RSPACK_PERSISTENT_CACHE;
    process.env.RSPACK_PERSISTENT_CACHE = 'true';
    try {
      await fn();
    } finally {
      if (previous === undefined) delete process.env.RSPACK_PERSISTENT_CACHE;
      else process.env.RSPACK_PERSISTENT_CACHE = previous;
    }
  };

  // Regression: this used to be configured under `experiments.cache`, a key
  // @rspack/core 2.x does not implement. Unknown `experiments` keys pass
  // validation untouched, so the cache silently never existed.
  it(
    'is declared at the top level, not under experiments',
    withOptIn(async () => {
      const { createRspackConfig } = await loadWithEnv('development');
      const config = createRspackConfig('client', { cacheKey: 'app-client' });

      expect(config.cache).toMatchObject({
        type: 'persistent',
        storage: { type: 'filesystem' },
      });
      expect(config.experiments?.cache).toBeUndefined();
    }),
  );

  it(
    'invalidates on the PostCSS plugin chain',
    withOptIn(async () => {
      const { createRspackConfig } = await loadWithEnv('development');
      const { buildDependencies } = createRspackConfig('client', {
        cacheKey: 'app-client',
      }).cache;

      // Neither file is a module in the graph, so only buildDependencies can
      // notice an edit to them.
      expect(
        buildDependencies.some(file =>
          file.endsWith('factories/postcss.factory.js'),
        ),
      ).toBe(true);
      expect(
        buildDependencies.some(file =>
          file.endsWith('postcss/RadixBreakpointTrim.js'),
        ),
      ).toBe(true);
    }),
  );

  it('stays off in production so an artifact never reuses a stale cache', async () => {
    const { createRspackConfig } = await loadWithEnv('production');

    expect(createRspackConfig('client', { cacheKey: 'app-client' }).cache).toBe(
      false,
    );
  });

  // Regression: `name` is a ROLE ('server' | 'client') reused by the app and
  // by every extension's client/server/api/nodes bundle. Keying the cache
  // directory on it pointed dozens of concurrent dev compilers at one storage
  // directory, which aborts the process with `Transaction already in progress`.
  it('defaults to in-memory cache in development', async () => {
    const { createRspackConfig } = await loadWithEnv('development');

    // Without the opt-in flag nothing touches the filesystem, whether or not
    // a cacheKey is declared.
    expect(createRspackConfig('client', { cacheKey: 'app-client' }).cache).toBe(
      true,
    );
    expect(createRspackConfig('server', {}).cache).toBe(true);
  });

  it(
    'keys the storage directory on cacheKey, not on name',
    withOptIn(async () => {
      const { createRspackConfig } = await loadWithEnv('development');

      const server = createRspackConfig('server', { cacheKey: 'app-server' });
      const client = createRspackConfig('client', { cacheKey: 'app-client' });

      expect(server.cache.storage.directory).toMatch(/app-server$/);
      expect(client.cache.storage.directory).toMatch(/app-client$/);
      expect(server.cache.storage.directory).not.toBe(
        client.cache.storage.directory,
      );

      // Extension bundles never get a filesystem directory to contend over.
      expect(createRspackConfig('server', {}).cache).toBe(true);
    }),
  );
});

describe('splitChunks cache groups', () => {
  // Regression: `marked` and `turndown` are non-eager Module Federation
  // shares. An enforced async chunk holding them waits on a shared module
  // whose fallback it contains — the hydration hang this file documents two
  // groups above. Restricting the group to initial chunks makes that
  // impossible while keeping markdown out of the editor chunk.
  it('pins the markdown vendor group to initial chunks', async () => {
    const { createCacheGroups } = await loadWithEnv('production');

    expect(createCacheGroups('all').markdown.chunks).toBe('initial');
    expect(createCacheGroups('async').markdown.chunks).toBe('initial');
  });

  it('leaves the other vendor groups on the requested chunk type', async () => {
    const { createCacheGroups } = await loadWithEnv('production');
    const groups = createCacheGroups('all');

    expect(groups.react.chunks).toBe('all');
    expect(groups.radix.chunks).toBe('all');
  });

  it('declares no enforced group for the TipTap or react-hook-form family', async () => {
    const { createCacheGroups } = await loadWithEnv('production');
    const groups = createCacheGroups('all');
    const tests = Object.values(groups)
      .map(group => String(group.test))
      .join('\n');

    expect(tests).not.toMatch(/tiptap|prosemirror|hookform|react-hook-form/i);
  });
});
