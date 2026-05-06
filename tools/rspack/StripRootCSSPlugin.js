/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { rspack } from '@rspack/core';

/**
 * Rspack plugin to strip :root CSS rules from final CSS assets.
 * Useful for stripping duplicate CSS variables or root themes from dynamically loaded extensions
 * to avoid polluting or conflicting with the host application's root scope.
 */
export default class StripRootCSSPlugin {
  constructor(options = {}) {
    this.options = {
      test: /\.css$/,
      verbose: false,
      ...options,
    };
  }

  /**
   * Safely removes all :root blocks from the CSS source by counting balanced braces.
   * This is more robust than Regex, as it correctly handles nested blocks if they exist.
   */
  _stripRootBlocks(source) {
    let result = source;
    const regex = /:root[\s\w="'-]*?\{/g;
    let match;

    // Process from right to left (bottom to top) so index removals don't shift earlier indices
    const matches = [];
    while ((match = regex.exec(result)) !== null) {
      matches.push({
        start: match.index,
        bracketStart: match.index + match[0].length - 1,
      });
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const { start, bracketStart } = matches[i];
      let depth = 1;
      let end = -1;

      // Scan forward to find the matching closing brace
      for (let j = bracketStart + 1; j < result.length; j++) {
        if (result[j] === '{') depth++;
        else if (result[j] === '}') depth--;

        if (depth === 0) {
          end = j;
          break;
        }
      }

      if (end !== -1) {
        // Strip out the matched block entirely
        result = result.substring(0, start) + result.substring(end + 1);
      }
    }

    return result;
  }

  apply(compiler) {
    const pluginName = 'StripRootCSSPlugin';

    compiler.hooks.compilation.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        assets => {
          Object.entries(assets).forEach(([name, asset]) => {
            if (!this.options.test.test(name)) return;

            const source = asset.source().toString();
            const stripped = this._stripRootBlocks(source);

            if (source.length !== stripped.length) {
              compilation.updateAsset(
                name,
                new rspack.sources.RawSource(stripped),
              );

              if (this.options.verbose) {
                console.log(`[StripRootCSSPlugin] Removed :root from ${name}`);
              }
            }
          });
        },
      );
    });
  }
}
