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

export default {
  canInstrument: true,
  
  process(src, filename, options) {
    if (src.includes('import.meta.webpackContext')) {
      src = src.replace(/import\.meta\.webpackContext/g, 'globalThis.__webpack_require_context__');
    }
    if (src.includes('require.context')) {
      src = src.replace(/require\.context/g, 'globalThis.__webpack_require_context__');
    }
    return swcTransformer.process(src, filename, options);
  },

  async processAsync(src, filename, options) {
    if (src.includes('import.meta.webpackContext')) {
      src = src.replace(/import\.meta\.webpackContext/g, 'globalThis.__webpack_require_context__');
    }
    if (src.includes('require.context')) {
      src = src.replace(/require\.context/g, 'globalThis.__webpack_require_context__');
    }
    return swcTransformer.processAsync(src, filename, options);
  },
};
