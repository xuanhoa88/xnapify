/**
 * Native Node.js require that works inside Webpack bundles.
 *
 * The standard `__non_webpack_require__` pattern compiles to Webpack's
 * `__webpack_require__` at runtime, which can resolve npm packages
 * (externals) but NOT arbitrary filesystem paths.
 *
 * This module uses `createRequire` from Node.js built-in `module` to
 * produce a genuine native require function for filesystem loading.
 *
 * @module shared/utils/createNativeRequire
 */

// eslint-disable-next-line no-undef
const moduleRequire =
  typeof __non_webpack_require__ === 'function'
    ? // eslint-disable-next-line no-undef
      __non_webpack_require__
    : require;

const { createRequire } = moduleRequire('module');

/**
 * Create a native Node.js require function scoped to a given filename.
 * Use this when you need to load modules from arbitrary filesystem paths
 * inside a Webpack-compiled bundle.
 *
 * @param {string} filename - The __filename to scope resolution from
 * @returns {NodeRequire} Native require function
 */
function createNativeRequire(filename) {
  return createRequire(filename);
}

module.exports = { createNativeRequire };
