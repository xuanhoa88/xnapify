/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// The build toolchain around this module is ESM-only and is not transformed
// for jest. None of it participates in the behaviour under test.
jest.mock('@rspack/core', () => {
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

import { assertLockfileMatchesManifest } from './build.js';

/** A lockfile in the shape `npm install --package-lock-only` writes. */
function lockfile(dependencies, devDependencies) {
  return {
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'xnapify',
        dependencies,
        ...(devDependencies ? { devDependencies } : {}),
      },
    },
  };
}

describe('assertLockfileMatchesManifest', () => {
  const manifest = { dependencies: { express: '4.22.2', react: '18.3.1' } };

  it('accepts a lockfile pinning exactly the manifest dependencies', () => {
    expect(() =>
      assertLockfileMatchesManifest(
        manifest,
        lockfile({ express: '4.22.2', react: '18.3.1' }),
      ),
    ).not.toThrow();
  });

  // Regression: nothing generated a lockfile for the build directory, so the
  // production `npm run setup` fell through to `npm install` and two images
  // from one commit could differ. A lockfile that does not describe
  // build/package.json is no better — `npm ci` rejects it outright.
  it('rejects a lockfile missing a manifest dependency', () => {
    expect(() =>
      assertLockfileMatchesManifest(manifest, lockfile({ express: '4.22.2' })),
    ).toThrow(/missing: react/);
  });

  it('rejects a lockfile carrying a dependency the manifest dropped', () => {
    expect(() =>
      assertLockfileMatchesManifest(
        manifest,
        lockfile({ express: '4.22.2', react: '18.3.1', sqlite3: '5.1.7' }),
      ),
    ).toThrow(/unexpected: sqlite3/);
  });

  it('rejects a lockfile that still carries devDependencies', () => {
    expect(() =>
      assertLockfileMatchesManifest(
        manifest,
        lockfile(
          { express: '4.22.2', react: '18.3.1' },
          { '@rspack/core': '2.0.1' },
        ),
      ),
    ).toThrow(/devDependencies/);
  });

  it('rejects a lockfile with no root package entry', () => {
    expect(() =>
      assertLockfileMatchesManifest(manifest, { lockfileVersion: 3 }),
    ).toThrow(/root package entry/);
  });
});
