/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

import { verbose } from './base.config.js';
import StatsManifestPlugin from './StatsManifestPlugin.js';

/**
 * Rspack plugin that writes a stats.json after each compilation.
 * Maps logical filenames (e.g. 'api.js') to their content-hashed physical
 * filenames (e.g. 'api.a1b2c3d4.js'). This enables runtime resolution of
 * extension bundles without hardcoded filenames, solving browser and Node.js
 * caching issues.
 *
 * Each compilation config should specify `localIdentName` in the plugin
 * constructor to define which logical name this build's output maps to.
 */
class BuildManifestPlugin extends StatsManifestPlugin {
  /**
   * @param {string} localIdentName - Logical filename key (e.g. 'api.js')
   */
  constructor(localIdentName) {
    super({
      filename: 'stats.json',
      incremental: true,
      ignoreErrors: false,
      statsOptions: { all: false, assets: true },
      transform: (statsData, manifest) => {
        // Find the emitted asset matching this logical name's base
        // e.g. localIdentName='api.js' matches 'api.a1b2c3d4.js'
        const logicalBase = localIdentName.replace(/\.[^.]+$/, ''); // 'api'
        const logicalExt = path.extname(localIdentName); // '.js'

        const assets = (statsData.assets || [])
          .map(a => (typeof a === 'string' ? a : a && a.name))
          .filter(Boolean);

        // Match pattern: <logicalBase>.<hash><logicalExt>
        const hashPattern = new RegExp(
          `^${logicalBase}\\.[a-f0-9]{8}\\${logicalExt}$`,
        );
        const matched = assets.find(name => hashPattern.test(name));

        if (matched) {
          manifest[localIdentName] = matched;
        } else {
          // Fallback: exact match (for non-hashed builds)
          const exact = assets.find(name => name === localIdentName);
          if (exact) manifest[localIdentName] = exact;
        }

        manifest.builtAt = Date.now();

        if (verbose) {
          console.log(
            `[BuildManifestPlugin] ${localIdentName} → ${manifest[localIdentName] || '(not found)'}`,
          );
        }

        return manifest;
      },
    });
  }
}

export default BuildManifestPlugin;
