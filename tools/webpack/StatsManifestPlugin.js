/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

/**
 * A generalized, reusable Webpack plugin for generating custom stats/manifest files.
 * Provides hooks to extract and transform Webpack build telemetry into custom JSON
 * shapes (like SSR asset lists or Module Federation dynamic resolving maps), while
 * managing file system merging and overwrites natively.
 */
class StatsManifestPlugin {
  /**
   * @param {Object} options
   * @param {string} options.filename - The output filename (can be absolute or relative to output.path)
   * @param {boolean} [options.incremental=false] - Whether to read and merge the existing file contents
   * @param {Object} [options.statsOptions] - Arguments to pass to stats.toJson()
   * @param {Function} options.transform - Function to transform statsData + existing manifest into the final manifest output
   */
  constructor(options = {}) {
    this.options = {
      filename: 'stats.json',
      incremental: false,
      ignoreErrors: true,
      statsOptions: { all: false, assets: true },
      transform: statsData => statsData,
      ...options,
    };
  }

  apply(compiler) {
    compiler.hooks.done.tap('StatsManifestPlugin', stats => {
      const { filename, incremental, ignoreErrors, statsOptions, transform } =
        this.options;

      if (stats.hasErrors()) {
        console.warn(
          `[StatsManifestPlugin] Build completed with errors. The emitted ${filename} might be incomplete.`,
        );
        if (!ignoreErrors) return; // Prevent overwriting existing valid manifests on broken recompiles
      }

      // Resolve the final path safely
      const manifestPath = path.isAbsolute(filename)
        ? filename
        : path.join(compiler.outputPath, filename);

      const statsData = stats.toJson(statsOptions);

      try {
        let manifest = {};
        if (incremental) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          } catch {
            // File does not exist or is invalid JSON; start fresh
          }
        }

        const nextManifest = transform(statsData, manifest, compiler);

        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
      } catch (err) {
        console.error(
          `[StatsManifestPlugin] Failed to generate or write ${filename}:`,
          err,
        );
        throw err;
      }
    });
  }
}

module.exports = StatsManifestPlugin;
