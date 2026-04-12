/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Babel configuration
 * Supports:
 *  - Modern JS (ESNext)
 *  - React (automatic runtime)
 *  - Optimizations for production
 */

module.exports = api => {
  const { babelConfigs } = require('./registry.factory');

  // Cache config per NODE_ENV — config only varies by isProd/isTest.
  // React Refresh babel plugin is injected at the webpack loader level
  // (configureWebpackForDev in dev.js), not here, so caching is safe.
  api.cache.using(() => process.env.NODE_ENV);

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  return {
    /**
     * Explicitly map module/extension babel configurations from the central registry
     */
    overrides: (Array.isArray(babelConfigs) ? babelConfigs : []).map(cfg => ({
      test: new RegExp(`^${cfg.moduleDir.replace(/\\/g, '/')}/`),
      extends: cfg.path,
    })),

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
      // ⚙ Class fields & private methods
      // =====================
      [
        'module-resolver',
        {
          alias: {
            '@shared': './shared',
          },
        },
      ],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      '@babel/plugin-transform-class-static-block',

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
      // 🧪 Test environment
      // =====================
      ...(isTest ? [require.resolve('./jest/requireContextPolyfill')] : []),

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
