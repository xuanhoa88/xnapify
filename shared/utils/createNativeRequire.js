/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Native Node.js require that works inside Rspack bundles.
 *
 * The standard `__non_webpack_require__` pattern compiles to Rspack's
 * internal require at runtime, which can resolve npm packages
 * (externals) but NOT arbitrary filesystem paths.
 *
 * This module uses `createRequire` from Node.js built-in `module` to
 * produce a genuine native require function for filesystem loading.
 *
 * @module shared/utils/createNativeRequire
 */

import { createRequire } from 'module';

/**
 * Create a native Node.js require function scoped to a given filename.
 * Use this when you need to load modules from arbitrary filesystem paths
 * inside a Rspack-compiled bundle.
 *
 * @param {string} filename - The __filename to scope resolution from
 * @returns {NodeRequire} Native require function
 */
export function createNativeRequire(filename) {
  return createRequire(filename);
}
