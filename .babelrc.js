/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Babel configuration
 * Supports:
 *  - Modern JS (ESNext)
 *  - React (automatic runtime)
 *  - Code splitting (@loadable/component)
 *  - Optimizations for production
 */

module.exports = api => {
  // Always recalc config — Webpack + React Refresh need this
  api.cache.never();

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isProd = NODE_ENV === 'production';

  return {
    /**
     * Use inline source maps for best debugging with Webpack + HMR
     * (external maps often break HMR invalidation)
     */
    sourceMaps: 'inline',

    /**
     * Important:
     * Server code runs on Node → target Node
     * Client code is handled by Browserslist via Webpack
     * This works fine for both sides.
     */
    presets: [
      [
        '@babel/preset-env',
        {
          targets: 'defaults',
          modules: 'commonjs',
          useBuiltIns: 'usage',
          corejs: 3,
        },
      ],

      [
        '@babel/preset-react',
        {
          development: !isProd,
          runtime: 'automatic',
        },
      ],
    ],

    plugins: [
      // =====================
      // 📦 Code splitting
      // =====================
      '@loadable/babel-plugin',

      // =====================
      // ⚙ Class fields & private methods
      // =====================
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],

      // =====================
      // 📘 Modern JavaScript Features
      // (Babel 7+ includes most of these in preset-env; keeping only necessary)
      // =====================
      '@babel/plugin-syntax-dynamic-import',
      '@babel/plugin-transform-export-namespace-from',
      '@babel/plugin-transform-json-strings',
      '@babel/plugin-transform-numeric-separator',
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-object-rest-spread',

      // =====================
      // 🚀 Production Optimizations
      // =====================
      ...(isProd
        ? [
            '@babel/plugin-transform-react-constant-elements',
            '@babel/plugin-transform-react-inline-elements',
            'babel-plugin-transform-react-remove-prop-types',
          ]
        : []),
    ],
  };
};
