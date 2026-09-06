/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import * as buildUtils from '../../../../../tools/utils/extension.js';

import {
  computeChecksum,
  hashManifest,
  stableStringify,
  verifyExtensionChecksum,
} from './checksum.util.js';

// The build task loads the same module through this barrel. Importing it here
// is what proves the publisher and the installer cannot drift apart.

let workDir;

beforeEach(async () => {
  workDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'xnapify-checksum-'),
  );
});

afterEach(async () => {
  await fs.promises.rm(workDir, { recursive: true, force: true });
});

/**
 * Write a minimal built extension tree (no manifest yet).
 */
async function writeExtensionTree(dir) {
  await fs.promises.mkdir(path.join(dir, 'views'), { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'api.js'), 'export default {};');
  await fs.promises.writeFile(
    path.join(dir, 'views', 'browser.js'),
    'export default {};',
  );
}

/**
 * Reproduce what tools/tasks/extension.js does at package time: hash the built
 * tree together with the manifest it is about to write, then write that
 * manifest with the checksum and build timestamp folded in.
 */
async function packageExtension(dir, overrides = {}) {
  const manifest = {
    name: '@acme/demo',
    version: '1.0.0',
    main: './api.js',
    browser: './views/browser.js',
    id: 'abcde',
    builtAt: 1_700_000_000_000,
    xnapify: { version: '^2.0.0', capabilities: ['hook'] },
    ...overrides,
  };

  const integrity = await buildUtils.computeChecksum(dir, { manifest });
  manifest.integrity = integrity;

  await fs.promises.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify(manifest, null, 2),
  );

  return { manifest, integrity };
}

describe('extension checksum round-trip', () => {
  it('the published integrity matches what the installer computes', async () => {
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    // The installer only ever sees the shipped directory.
    await expect(computeChecksum(workDir)).resolves.toBe(integrity);
    await expect(
      verifyExtensionChecksum(workDir, integrity),
    ).resolves.toMatchObject({ valid: true });
  });

  it('is stable across a rebuild that only changes the build timestamp', async () => {
    await writeExtensionTree(workDir);
    const first = await packageExtension(workDir, { builtAt: 1 });
    const second = await packageExtension(workDir, { builtAt: 2 });

    expect(second.integrity).toBe(first.integrity);
  });

  it('does not depend on the stale manifest left by a previous build', async () => {
    await writeExtensionTree(workDir);
    await fs.promises.writeFile(
      path.join(workDir, 'package.json'),
      JSON.stringify({ name: '@acme/demo', integrity: 'stale', builtAt: 0 }),
    );
    const fresh = await packageExtension(workDir);

    await expect(computeChecksum(workDir)).resolves.toBe(fresh.integrity);
  });

  it('changes when a source file is tampered with', async () => {
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    await fs.promises.writeFile(
      path.join(workDir, 'api.js'),
      'export default { evil: true };',
    );

    await expect(
      verifyExtensionChecksum(workDir, integrity),
    ).resolves.toMatchObject({ valid: false });
  });

  it('changes when a hashed manifest field is tampered with', async () => {
    await writeExtensionTree(workDir);
    const { manifest, integrity } = await packageExtension(workDir);

    await fs.promises.writeFile(
      path.join(workDir, 'package.json'),
      JSON.stringify({
        ...manifest,
        xnapify: { version: '^2.0.0', capabilities: ['*'] },
      }),
    );

    await expect(
      verifyExtensionChecksum(workDir, integrity),
    ).resolves.toMatchObject({ valid: false });
  });

  it('ignores node_modules and lockfiles added by the runtime installer', async () => {
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    await fs.promises.mkdir(path.join(workDir, 'node_modules', 'left-pad'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(workDir, 'node_modules', 'left-pad', 'index.js'),
      'module.exports = 1;',
    );
    await fs.promises.writeFile(
      path.join(workDir, 'package-lock.json'),
      '{"lockfileVersion":3}',
    );

    await expect(computeChecksum(workDir)).resolves.toBe(integrity);
  });

  it('exposes the same implementation to the build task', () => {
    expect(buildUtils.computeChecksum).toBe(computeChecksum);
    expect(buildUtils.hashManifest).toBe(hashManifest);
  });
});

describe('hashManifest', () => {
  it('ignores key order and formatting', () => {
    expect(hashManifest({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashManifest({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it('ignores the fields that describe the build itself', () => {
    expect(hashManifest({ name: 'x', integrity: 'a', builtAt: 1 })).toBe(
      hashManifest({ name: 'x', integrity: 'b', builtAt: 2 }),
    );
  });

  it('is stable for a missing manifest', () => {
    expect(hashManifest(null)).toBe('no-manifest');
  });
});

describe('stableStringify', () => {
  it('sorts object keys at every depth', () => {
    expect(stableStringify({ b: [{ z: 1, a: 2 }], a: null })).toBe(
      '{"a":null,"b":[{"a":2,"z":1}]}',
    );
  });
});
