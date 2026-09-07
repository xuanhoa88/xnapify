/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import config from '../config.js';

import { generateExtensionId, listBundledExtensionIds } from './extension.js';

// Resolved the same way listBundledExtensionIds resolves it, rather than
// hardcoding 'src', so the two cannot disagree when APP_DIR is overridden.
const EXTENSIONS_DIR = path.resolve(
  config.APP_DIR,
  config.env('XNAPIFY_EXTENSION_LOCAL_PATH', 'extensions'),
);

const manifests = fs
  .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry =>
    JSON.parse(
      fs.readFileSync(
        path.join(EXTENSIONS_DIR, entry.name, 'package.json'),
        'utf8',
      ),
    ),
  );

describe('listBundledExtensionIds', () => {
  it('finds the bundled extensions', () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it.each(manifests.map(m => [m.name, m]))(
    '%s is listed under both its name and its derived id',
    name => {
      // The build lists what it compiled and DefinePlugin injects that list;
      // the runtime half of this chain — that compat.js then matches a manifest
      // against the list — is asserted in
      // shared/extension/utils/compat.test.js, because `tools/` is a standalone
      // package and does not import from shared/.
      const ids = listBundledExtensionIds();
      expect(ids).toContain(name);
      expect(ids).toContain(generateExtensionId(name));
    },
  );

  it('returns an empty list when the directory is absent', () => {
    const previous = process.env.XNAPIFY_EXTENSION_LOCAL_PATH;
    process.env.XNAPIFY_EXTENSION_LOCAL_PATH = 'extensions-that-do-not-exist';
    try {
      expect(listBundledExtensionIds()).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.XNAPIFY_EXTENSION_LOCAL_PATH;
      } else {
        process.env.XNAPIFY_EXTENSION_LOCAL_PATH = previous;
      }
    }
  });
});

describe('generateExtensionId', () => {
  it('is a pure function of the name, so every machine derives the same id', () => {
    // Deriving the alphabet from XNAPIFY_KEY (as an earlier version did) tied
    // ids to a secret, so rotating the key orphaned every extensions.key row.
    expect(generateExtensionId('@xnapify-extension/profile')).toBe(
      generateExtensionId('@xnapify-extension/profile'),
    );
    expect(generateExtensionId('@xnapify-extension/profile')).not.toBe(
      generateExtensionId('@xnapify-extension/other'),
    );
  });

  it('rejects a name that is not a non-empty string', () => {
    expect(generateExtensionId('')).toBeNull();
    expect(generateExtensionId(null)).toBeNull();
    expect(generateExtensionId(42)).toBeNull();
  });
});
