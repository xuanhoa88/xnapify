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
  // Regression: this used to be configured under `experiments.cache`, a key
  // @rspack/core 2.x does not implement. Unknown `experiments` keys pass
  // validation untouched, so the cache silently never existed.
  it('is declared at the top level, not under experiments', async () => {
    const { createRspackConfig } = await loadWithEnv('development');
    const config = createRspackConfig('client', {});

    expect(config.cache).toMatchObject({
      type: 'persistent',
      storage: { type: 'filesystem' },
    });
    expect(config.experiments?.cache).toBeUndefined();
  });

  it('invalidates on the PostCSS plugin chain', async () => {
    const { createRspackConfig } = await loadWithEnv('development');
    const { buildDependencies } = createRspackConfig('client', {}).cache;

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
  });

  it('stays off in production so an artifact never reuses a stale cache', async () => {
    const { createRspackConfig } = await loadWithEnv('production');

    expect(createRspackConfig('client', {}).cache).toBe(false);
  });
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
