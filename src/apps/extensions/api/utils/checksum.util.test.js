/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import * as buildChecksum from '../../../../../tools/utils/checksum.js';
import * as buildUtils from '../../../../../tools/utils/extension.js';

import {
  CHECKSUM_VERSION,
  DEFAULT_OPTIONS,
  MANIFEST_FILE,
  SELF_REFERENTIAL_MANIFEST_FIELDS,
  checksumMismatchReason,
  computeChecksum,
  hashManifest,
  parseChecksum,
  stableStringify,
  verifyExtensionChecksum,
} from './checksum.util.js';

// `tools/` is a standalone build-time package — it imports nothing from src/ or
// shared/ — so the publishing half of this algorithm lives in
// tools/utils/checksum.js and the verifying half lives here. They are two
// implementations that must produce identical digests, so this file is the
// guard: `packageExtension` below publishes with the *build* copy and every
// assertion verifies with the *runtime* copy, and the drift suite at the bottom
// compares them directly. Change one side and this goes red — which is the
// cheap failure, as against a valid extension reported as TAMPERED in
// production.

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
});

describe('the build copy and the runtime copy cannot drift apart', () => {
  /**
   * These are two separate implementations by design — `tools/` imports nothing
   * outside itself. Identity (`===`) is therefore the wrong assertion; agreeing
   * on every digest is the right one.
   *
   * Comparing digests over fixtures is necessary but *not sufficient*, and the
   * gap is worth stating because it is easy to build a guard that looks strict
   * and catches nothing. An exclusion list that drifts on one side only changes
   * a digest when the fixture happens to contain a file with the newly-excluded
   * name — add `'CHANGELOG.md'` to one copy and every output assertion below
   * still passes. So the parameters that *define* the algorithm are compared
   * structurally as well, and the two halves cover different failures:
   *
   *   - parameters  → exclusion lists, version tag, stripped manifest fields
   *   - digests     → hashing logic, ordering, the domain separator
   */
  describe('parameters', () => {
    it('excludes exactly the same files and folders from the tree hash', () => {
      expect(buildChecksum.DEFAULT_OPTIONS).toEqual(DEFAULT_OPTIONS);
    });

    it('agrees on the version tag and the manifest filename', () => {
      expect(buildChecksum.CHECKSUM_VERSION).toBe(CHECKSUM_VERSION);
      expect(buildChecksum.MANIFEST_FILE).toBe(MANIFEST_FILE);
    });

    it('strips the same self-referential manifest fields', () => {
      expect(buildChecksum.SELF_REFERENTIAL_MANIFEST_FIELDS).toEqual(
        SELF_REFERENTIAL_MANIFEST_FIELDS,
      );
    });
  });

  describe('shared primitives', () => {
    it('canonicalises objects identically', () => {
      const tricky = {
        z: [3, { b: 2, a: 1 }],
        a: null,
        nested: { '': 0, ünïcode: '✓', 'with"quote': true },
      };
      expect(buildChecksum.stableStringify(tricky)).toBe(
        stableStringify(tricky),
      );
    });

    it('hashes manifests identically, including the absent case', () => {
      const manifest = { name: '@acme/demo', integrity: 'x', builtAt: 1 };
      expect(buildChecksum.hashManifest(manifest)).toBe(hashManifest(manifest));
      expect(buildChecksum.hashManifest(null)).toBe(hashManifest(null));
    });
  });

  it('agrees on a plain built tree', async () => {
    await writeExtensionTree(workDir);

    await expect(buildUtils.computeChecksum(workDir)).resolves.toBe(
      await computeChecksum(workDir),
    );
  });

  it('agrees when the manifest is supplied instead of read from disk', async () => {
    // The build path: the manifest has not been written yet, so it is passed in.
    await writeExtensionTree(workDir);
    const manifest = {
      name: '@acme/demo',
      version: '2.3.4',
      xnapify: { version: '^2.0.0', capabilities: ['hook', 'db'] },
    };

    await expect(
      buildUtils.computeChecksum(workDir, { manifest }),
    ).resolves.toBe(await computeChecksum(workDir, { manifest }));
  });

  it('agrees on a directory that has no manifest at all', async () => {
    await writeExtensionTree(workDir);

    await expect(buildUtils.computeChecksum(workDir)).resolves.toBe(
      await computeChecksum(workDir),
    );
  });

  it('agrees about which files are excluded from the hash', async () => {
    await writeExtensionTree(workDir);
    const before = await buildUtils.computeChecksum(workDir);

    await fs.promises.mkdir(path.join(workDir, 'node_modules', 'dep'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(workDir, 'node_modules', 'dep', 'index.js'),
      'module.exports = 1;',
    );
    await fs.promises.writeFile(path.join(workDir, '.DS_Store'), 'junk');
    await fs.promises.writeFile(
      path.join(workDir, 'package-lock.json'),
      '{"lockfileVersion":3}',
    );

    // Both must still ignore all three, and still agree with each other.
    await expect(buildUtils.computeChecksum(workDir)).resolves.toBe(before);
    await expect(computeChecksum(workDir)).resolves.toBe(before);
  });

  it('agrees that a nested source change moves the digest', async () => {
    await writeExtensionTree(workDir);
    const before = await buildUtils.computeChecksum(workDir);

    await fs.promises.writeFile(
      path.join(workDir, 'views', 'browser.js'),
      'export default { changed: true };',
    );

    const buildAfter = await buildUtils.computeChecksum(workDir);
    expect(buildAfter).not.toBe(before);
    await expect(computeChecksum(workDir)).resolves.toBe(buildAfter);
  });

  it('agrees on the version tag, so neither side can bump it alone', async () => {
    // A one-sided version bump is the exact failure that once turned an upgrade
    // into a tamper report for every pre-existing install.
    await writeExtensionTree(workDir);
    const fromBuild = await buildUtils.computeChecksum(workDir);

    expect(fromBuild.startsWith(`${CHECKSUM_VERSION}:`)).toBe(true);
    expect(parseChecksum(fromBuild).version).toBe(CHECKSUM_VERSION);
  });
});

describe('checksum versioning', () => {
  it('tags every checksum it produces with the current version', async () => {
    // A bare digest is indistinguishable from one written by an older
    // algorithm, which is how an upgrade turned into a false tamper report:
    // every pre-existing install failed to verify with no way to tell why.
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    expect(integrity).toMatch(/^v2:[0-9a-f]{64}$/);
    expect(parseChecksum(integrity)).toEqual({
      version: CHECKSUM_VERSION,
      digest: integrity.slice(CHECKSUM_VERSION.length + 1),
    });
  });

  it('reads an unversioned value as unparseable, not as a digest', () => {
    expect(parseChecksum('a'.repeat(64))).toBeNull();
    expect(parseChecksum('')).toBeNull();
    expect(parseChecksum(null)).toBeNull();
    expect(parseChecksum('v2:short')).toBeNull();
  });

  it('reports an unverifiable stored value as comparable:false', async () => {
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    const legacy = await verifyExtensionChecksum(workDir, 'a'.repeat(64));
    expect(legacy.comparable).toBe(false);
    expect(legacy.valid).toBe(false);
    expect(legacy.storedVersion).toBeNull();

    const future = await verifyExtensionChecksum(
      workDir,
      `v9:${'a'.repeat(64)}`,
    );
    expect(future.comparable).toBe(false);
    expect(future.storedVersion).toBe('v9');

    const current = await verifyExtensionChecksum(workDir, integrity);
    expect(current.comparable).toBe(true);
    expect(current.valid).toBe(true);
  });

  it('separates a content mismatch from a format mismatch', async () => {
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    expect(checksumMismatchReason(integrity, integrity)).toBeNull();
    expect(checksumMismatchReason(`v2:${'b'.repeat(64)}`, integrity)).toBe(
      'content',
    );
    expect(checksumMismatchReason('a'.repeat(64), integrity)).toBe(
      'unversioned',
    );
    expect(checksumMismatchReason(`v9:${'a'.repeat(64)}`, integrity)).toBe(
      'version',
    );
  });

  it('does not call a whitespace-padded stored value a content mismatch', async () => {
    // Nothing normalises the checksum a registry entry supplies, and parsing
    // tolerates padding — so a value with a trailing newline clears the version
    // gate and reaches the comparison. Calling that package tampered with is the
    // most serious verdict here, raised over one invisible byte: the operator
    // message truncates both values and never shows the difference.
    await writeExtensionTree(workDir);
    const { integrity } = await packageExtension(workDir);

    expect(checksumMismatchReason(`${integrity}\n`, integrity)).toBeNull();
    expect(checksumMismatchReason(`  ${integrity}  `, integrity)).toBeNull();

    await expect(
      verifyExtensionChecksum(workDir, `${integrity}\n`),
    ).resolves.toMatchObject({ valid: true, comparable: true });

    // Padding must not make a genuinely different digest verify.
    expect(checksumMismatchReason(`v2:${'b'.repeat(64)}\n`, integrity)).toBe(
      'content',
    );
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

  // computeChecksum hashes whatever package.json a registry or upload
  // handed it, before validateManifest has looked at anything but
  // name/version/host-compat — so an attacker-nested value reaches this
  // function directly. Without a cap, that overflows the V8 call stack;
  // the depth this throws at must sit safely below that limit.
  function nest(depth) {
    let value = 0;
    for (let i = 0; i < depth; i += 1) value = [value];
    return value;
  }

  it('rejects nesting deep enough to overflow the call stack, cleanly', () => {
    expect(() => stableStringify(nest(5000))).toThrow(RangeError);
    expect(() => stableStringify(nest(5000))).not.toThrow(/call stack/i);
  });

  it('still serialises nesting an ordinary manifest could plausibly use', () => {
    expect(() => stableStringify(nest(50))).not.toThrow();
  });
});
