/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// The build toolchain around this module is ESM-only and is not transformed
// for jest. None of it participates in the behaviour under test.
jest.mock('@rspack/core', () => {
  // Any property is a namespace, a constructor or a value, depending on where
  // the config touches it; a self-returning proxy satisfies all three.
  const stub = () =>
    new Proxy(function Stub() {}, {
      get: (_target, prop) => (prop === 'then' ? undefined : stub()),
      construct: () => ({}),
      apply: () => stub(),
    });
  return { rspack: stub() };
});
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

import { buildViewMap } from './app.config.js';

const VIEW_SOURCE = '/repo/src/apps/blog/views/(routes)/(post)/_route.js';
/** buildViewMap keys views by their path below `src/apps/`. */
const VIEW = 'blog/views/(routes)/(post)/_route.js';

/**
 * A compilation stub holding one view module spread across `chunks`.
 *
 * @param {Array<{id: string, files: string[], initial?: boolean}>} chunks
 */
function stubCompilation(chunks) {
  const mod = { resource: VIEW_SOURCE };
  return {
    modules: [mod],
    chunkGraph: {
      getModuleChunksIterable: () =>
        chunks.map(chunk => ({
          id: chunk.id,
          files: chunk.files,
          canBeInitial: () => Boolean(chunk.initial),
        })),
    },
  };
}

/** Matching stats payload, in the shape `chunks: true` produces. */
function stubStats(chunks) {
  return {
    chunks: chunks.map(chunk => ({
      id: chunk.id,
      files: chunk.files,
      entry: Boolean(chunk.entry),
      initial: Boolean(chunk.initial),
      siblings: chunk.siblings || [],
    })),
  };
}

describe('buildViewMap', () => {
  it('maps a view to its own async chunk', () => {
    const chunks = [{ id: '42', files: ['route.abc.js'] }];

    expect(buildViewMap(stubCompilation(chunks), stubStats(chunks))).toEqual({
      [VIEW]: ['route.abc.js'],
    });
  });

  // Regression: the JSDoc and the sibling collection both skip entry and
  // initial chunks, but the primary loop listed them anyway — so every view
  // re-advertised the bundle the page already carries.
  it('skips the entry and initial chunks a view also lives in', () => {
    const chunks = [
      { id: '0', files: ['client.abc.js'], entry: true, initial: true },
      { id: '1', files: ['vendor.react.abc.js'], initial: true },
      { id: '42', files: ['route.abc.js'] },
    ];

    expect(buildViewMap(stubCompilation(chunks), stubStats(chunks))).toEqual({
      [VIEW]: ['route.abc.js'],
    });
  });

  it('omits a view whose only chunks are initial', () => {
    const chunks = [
      { id: '0', files: ['client.abc.js'], entry: true, initial: true },
    ];

    expect(buildViewMap(stubCompilation(chunks), stubStats(chunks))).toEqual(
      {},
    );
  });

  it('still pulls in async siblings of the view chunk', () => {
    const chunks = [
      { id: '42', files: ['route.abc.js'], siblings: ['43'] },
      { id: '43', files: ['locale.en.abc.js'] },
    ];

    expect(buildViewMap(stubCompilation(chunks), stubStats(chunks))).toEqual({
      [VIEW]: ['route.abc.js', 'locale.en.abc.js'],
    });
  });

  it('ignores hot-update files and non-scripts', () => {
    const chunks = [
      {
        id: '42',
        files: ['route.abc.js', 'route.abc.css', 'route.hot-update.js'],
      },
    ];

    expect(buildViewMap(stubCompilation(chunks), stubStats(chunks))).toEqual({
      [VIEW]: ['route.abc.js'],
    });
  });
});
