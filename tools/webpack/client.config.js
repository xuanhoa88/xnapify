/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const LoadablePlugin = require('@loadable/webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const config = require('../config');
const { isVerbose } = require('../utils/logger');
const {
  createBaseConfig,
  createCSSRule,
  createDefinePluginConfig,
  isAnalyze,
  isDebug,
  isProfile,
  reScript,
} = require('./base.config');

const verbose = isVerbose(); // Cache verbose check

// Initialize base webpack configuration with common settings for all environments
const baseConfig = createBaseConfig();

// React Fast Refresh (HMR)
if (isDebug) {
  // Recursively adds a Babel plugin to matching rules
  const addBabelLoaderPluginToRule = (rules, plugin, testFn) => {
    if (!Array.isArray(rules)) return;

    rules.forEach(rule => {
      if (!rule) return;

      // Check if the current rule matches the test function
      if (testFn(rule)) {
        const loaders = (
          Array.isArray(rule.use) ? rule.use : [rule.use]
        ).filter(Boolean);

        loaders.forEach(loaderConfig => {
          // Handle both string and object loader configurations
          const loader =
            typeof loaderConfig === 'string'
              ? loaderConfig
              : loaderConfig && loaderConfig.loader;

          // Only modify babel-loader configurations
          if (loader === 'babel-loader') {
            // Ensure we're working with an object configuration
            const cfg = typeof loaderConfig === 'object' ? loaderConfig : null;
            if (!cfg) return;

            cfg.options = cfg.options || {};
            cfg.options.plugins = cfg.options.plugins || [];

            // Add the plugin if not already present (check by resolved path)
            const pluginExists = cfg.options.plugins.some(
              p => p === plugin || (Array.isArray(p) && p[0] === plugin),
            );

            if (!pluginExists) {
              cfg.options.plugins.push(plugin);
            }
          }
        });
      }

      // Recursively process nested rules (like oneOf)
      if (rule.oneOf) {
        addBabelLoaderPluginToRule(rule.oneOf, plugin, testFn);
      }
    });
  };

  // Add React Refresh Babel plugin to JS/JSX files
  // This enables component hot reloading without losing component state
  const baseRules =
    baseConfig.module && baseConfig.module.rules ? baseConfig.module.rules : [];
  addBabelLoaderPluginToRule(
    baseRules,
    require.resolve('react-refresh/babel'),
    rule => rule.test && reScript === rule.test,
  );
}

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 */
module.exports = merge(baseConfig, {
  // Configuration name for multi-compiler mode (used in webpack logs)
  name: 'client',

  // Build target environment: 'web' for browser execution
  // https://webpack.js.org/configuration/target/
  // This tells webpack to:
  // - Bundle all dependencies (no Node.js built-ins)
  // - Generate code compatible with browsers
  // - Apply browser-specific optimizations (code splitting, tree shaking, etc.)
  target: 'web',

  // Entry point for client bundle
  // https://webpack.js.org/configuration/entry-context/
  entry: {
    // Client entry: src/client.js → build/public/assets/client.js (or client.[hash].js)
    // This is the browser-side application that hydrates the SSR markup
    client: [
      ...(isDebug
        ? [path.join(__dirname, 'browserSync', 'client.config.js')]
        : []),
      path.join(config.APP_DIR, 'client.js'),
    ],
  },

  // Output configuration for client bundle
  // https://webpack.js.org/configuration/output/
  output: {
    // Output directory: build/public/
    // Note: path must be static - cannot use [fullhash] placeholder
    // The hash is applied in filename/chunkFilename patterns instead
    path: path.join(config.BUILD_DIR, 'public'),

    // Entry file output:
    // - Development: assets/client.js (no hash for faster rebuilds)
    // - Production: assets-[fullhash]/client.[chunkhash:8].js
    // Example: assets-a1b2c3d4/client.e5f6g7h8.js
    filename: isDebug
      ? 'assets/[name].js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].js',

    // Code-split chunks output:
    // - Development: assets/[name].chunk.js
    // - Production: assets-[fullhash]/[name].[chunkhash:8].chunk.js
    // Hash changes only when chunk content changes (optimal caching)
    chunkFilename: isDebug
      ? 'assets/[name].chunk.js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].chunk.js',

    // Note: libraryTarget is not needed for client bundles
    // Client code executes immediately in the browser (via <script> tags)
    // Only server bundles need libraryTarget: 'commonjs2' for Node.js require()
  },

  module: {
    rules: [
      // CSS handling for client bundle (extracts CSS to separate files)
      createCSSRule({
        isClient: true,
        extractLoader: MiniCssExtractPlugin.loader,
      }),
    ],
  },

  plugins: [
    // Polyfill process for browser
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser'),
    }),

    // Define free variables
    // https://webpack.js.org/plugins/define-plugin/
    createDefinePluginConfig(),

    // Loadable Components Plugin - generates stats file for SSR code splitting
    // https://loadable-components.com/docs/api-loadable-server/
    new LoadablePlugin({
      // Output filename for the stats JSON file
      filename: 'loadable-stats.json',

      // Write the stats file to disk in development mode
      // The file will be written to the build directory specified in config.BUILD_DIR
      writeToDisk: {
        filename: config.BUILD_DIR, // Directory where the file will be written
      },

      // Don't include the stats file in webpack's assets
      // This prevents it from being included in the production build
      outputAsset: false,
    }),

    // Mini CSS Extract Plugin - extracts CSS into separate files
    // https://webpack.js.org/plugins/mini-css-extract-plugin/
    new MiniCssExtractPlugin({
      filename: isDebug
        ? 'assets/[name].css'
        : 'assets-[fullhash:8]/[name].[contenthash:8].css',
      chunkFilename: isDebug
        ? 'assets/[id].css'
        : 'assets-[fullhash:8]/[id].[contenthash:8].css',
      // Ignore order warnings in development (CSS Modules handle scoping)
      ignoreOrder: isDebug,
    }),

    // React Refresh Webpack Plugin - enables Fast Refresh for React components (development only)
    // Works together with react-refresh/babel plugin added to babel-loader above
    // https://github.com/pmmmwh/react-refresh-webpack-plugin
    ...(isDebug
      ? [
          new ReactRefreshWebpackPlugin({
            overlay: false, // Disable error overlay (we use webpack-dev-middleware's overlay)
          }),
        ]
      : []),

    // Webpack Bundle Analyzer (production only)
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    ...(isAnalyze && !isDebug
      ? [
          new BundleAnalyzerPlugin({
            // Mode: 'static' generates HTML report, 'json' for CI, 'server' for interactive
            analyzerMode: process.env.BUNDLE_ANALYZER_MODE || 'static',

            // Report output paths
            reportFilename: config.resolve(
              config.BUILD_DIR,
              'reports',
              'bundle-analyzer-report.html',
            ),
            statsFilename: config.resolve(
              config.BUILD_DIR,
              'reports',
              'bundle-analyzer-stats.json',
            ),

            // Don't open browser automatically (can override with env var)
            openAnalyzer: process.env.BUNDLE_ANALYZER_OPEN === 'true' || false,

            // Generate JSON stats file for CI/CD integration
            generateStatsFile: true,

            // Stats options for detailed analysis
            statsOptions: {
              source: false, // Exclude source code (reduces file size)
              reasons: verbose, // Why modules are included
              chunks: true, // Chunk information
              chunkModules: true, // Modules in each chunk
              modules: true, // Module information
              assets: true, // Asset information
              children: false, // Child compilations (not needed)
              cached: false, // Cached modules (not needed)
              cachedAssets: false, // Cached assets (not needed)
              performance: true, // Performance hints
              timings: true, // Build timing information
            },

            // Logging
            logLevel: verbose ? 'info' : 'warn',

            // Default sizes to show
            defaultSizes: 'gzip', // Show gzipped sizes by default

            // Exclude source maps from analysis
            excludeAssets: /\.map$/i,
          }),
        ]
      : []),

    // Progress plugin for build feedback
    ...(config.env('BUNDLE_PROGRESS') !== 'false' && verbose
      ? [
          new webpack.ProgressPlugin({
            activeModules: true,
            entries: true,
            modules: true,
            modulesCount: 5000,
            profile: isProfile,
            dependencies: true,
            dependenciesCount: 10000,
            percentBy: 'entries',
          }),
        ]
      : []),
  ].filter(Boolean),

  // Client-specific optimization configuration
  // https://webpack.js.org/configuration/optimization/
  optimization: {
    // Runtime chunk - separate webpack runtime for better caching (production only)
    runtimeChunk: !isDebug ? 'single' : false,

    // Minification (production only)
    minimize: !isDebug,

    // TerserPlugin for client - removes console in production
    ...(!isDebug
      ? {
          minimizer: [
            new TerserPlugin({
              parallel: true,
              terserOptions: {
                compress: {
                  drop_console: true, // Remove console.* in production
                },
              },
            }),
          ],
        }
      : {}),
  },

  // Some libraries import Node modules but don't use them in the browser.
  // Tell Webpack to provide empty mocks for them so importing them works.
  // https://webpack.js.org/configuration/node/
  // Note: In webpack 5, node option is deprecated in favor of resolve.fallback
  // Node polyfills are configured in base.js via resolve.fallback
  // In webpack 5, node option only accepts: __dirname, __filename, global
  node: {
    __dirname: false,
    __filename: false,
    global: false,
  },
});
