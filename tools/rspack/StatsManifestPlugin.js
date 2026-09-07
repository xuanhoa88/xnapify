/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

// Relative, with an explicit extension: this plugin is loaded by the raw-Node
// build task, where the `@shared` alias does not exist.
import { readJsonSafeSync, writeJsonAtomicSync } from '../atomic/index.js';

/**
 * A generalized, reusable rspack plugin for generating custom stats/manifest files.
 * Provides hooks to extract and transform rspack build telemetry into custom JSON
 * shapes (like SSR asset lists or Module Federation dynamic resolving maps), while
 * managing file system merging and overwrites natively.
 */
export default class StatsManifestPlugin {
  /**
   * @param {Object} options
   * @param {string} options.filename - The output filename (can be absolute or relative to output.path)
   * @param {boolean} [options.incremental=false] - Whether to read and merge the existing file contents
   * @param {Object} [options.statsOptions] - Arguments to pass to stats.toJson()
   * @param {Function} options.transform - Function to transform statsData + existing manifest into the final manifest output.
   *   Called as `(statsData, manifest, compiler, compilation)`. The live
   *   compilation is passed because module-level questions ("which chunk
   *   holds this source file?") are far cheaper to answer against it than
   *   through `stats.toJson({ chunkModules: true })`, which serialises every
   *   module of every chunk on every rebuild.
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
          // Missing is normal — this is the first compiler to run. Corrupt is
          // not: `incremental` means "merge with what another compiler already
          // wrote", so quietly starting from {} deletes those entries from the
          // manifest the server reads at boot, and the only symptom is a page
          // rendered with no scripts or stylesheets.
          manifest = readJsonSafeSync(manifestPath, {
            fallback: {},
            validate: value => value !== null && typeof value === 'object',
          });
        }

        const nextManifest = transform(
          statsData,
          manifest,
          compiler,
          stats.compilation,
        );

        // Atomic and durable: the server parses this file at boot, so a build
        // interrupted mid-write must leave the previous manifest intact rather
        // than a truncated one. One fsync per build is free at this frequency.
        writeJsonAtomicSync(manifestPath, nextManifest, { spaces: 2 });
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
