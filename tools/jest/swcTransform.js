/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import swcJest from '@swc/jest';

const swcTransformer = swcJest.createTransformer({
  jsc: {
    parser: {
      syntax: 'ecmascript',
      jsx: true,
      dynamicImport: true,
    },
    transform: {
      react: { runtime: 'automatic' },
    },
    loose: true,
  },
  module: { type: 'commonjs' },
});

/**
 * Rewrite bundler-only syntax that Node cannot parse or resolve.
 *
 * `import.meta.webpackHot` matters as much as the context helpers: swc emits
 * CommonJS, so any surviving `import.meta` makes Node throw
 * `SyntaxError: Cannot use 'import.meta' outside a module` at require time.
 * src/server.js and src/client.js both reference it, so without this rewrite
 * neither entry file can be imported by a test at all.
 */
function rewriteBundlerGlobals(src) {
  if (src.includes('import.meta.webpackContext')) {
    src = src.replace(
      /import\.meta\.webpackContext/g,
      'globalThis.__webpack_require_context__',
    );
  }
  if (src.includes('require.context')) {
    src = src.replace(
      /require\.context/g,
      'globalThis.__webpack_require_context__',
    );
  }
  // Undefined, not a stub: `if (import.meta.webpackHot)` must take the
  // production branch under test, which is the branch we want to exercise.
  if (src.includes('import.meta.webpackHot')) {
    src = src.replace(/import\.meta\.webpackHot/g, 'undefined');
  }
  return src;
}

export default {
  canInstrument: true,

  process(src, filename, options) {
    return swcTransformer.process(
      rewriteBundlerGlobals(src),
      filename,
      options,
    );
  },

  async processAsync(src, filename, options) {
    return swcTransformer.processAsync(
      rewriteBundlerGlobals(src),
      filename,
      options,
    );
  },
};
