/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import { isBundledExtension } from '@shared/extension/utils/compat.js';

import { generateExtensionId, listBundledExtensionIds } from './extension.js';

const EXTENSIONS_DIR = path.resolve(process.cwd(), 'src', 'extensions');

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
    '%s reaches the runtime as bundled',
    (name, manifest) => {
      // This is the whole chain the privileged capability tier rests on: the
      // build lists what it compiled, DefinePlugin injects the list, and
      // compat.js matches a manifest against it. A first-party extension that
      // fell out of the list would silently lose `models`/`db` in production
      // and fail at its first resolve().
      const ids = listBundledExtensionIds();
      expect(ids).toContain(name);
      expect(ids).toContain(generateExtensionId(name));

      // eslint-disable-next-line no-underscore-dangle
      const previous = globalThis.__XNAPIFY_BUNDLED_EXTENSIONS__;
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__XNAPIFY_BUNDLED_EXTENSIONS__ = ids;
      try {
        expect(isBundledExtension(manifest)).toBe(true);
      } finally {
        // eslint-disable-next-line no-underscore-dangle
        globalThis.__XNAPIFY_BUNDLED_EXTENSIONS__ = previous;
      }
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
