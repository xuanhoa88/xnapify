/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import LoadablePlugin from '@loadable/webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { merge } from 'webpack-merge';
import config from '../config';
import { isVerbose } from '../lib/logger';
import baseConfig, {
  createCSSRule,
  createDefinePluginConfig,
  isAnalyze,
  isDebug,
  isProfile,
} from './base.config';

// Client webpack configuration
const BUNDLE_MAX_CHUNK_SIZE =
  parseInt(config.env('BUNDLE_MAX_CHUNK_SIZE'), 10) || 1000000; // 1MB
const BUNDLE_TREE_SHAKING = config.env('BUNDLE_TREE_SHAKING') !== 'false';
const BUNDLE_MINIFICATION = config.env('BUNDLE_MINIFICATION') !== 'false';
const BUNDLE_PROGRESS_REPORTING = config.env('BUNDLE_PROGRESS') !== 'false';

const verbose = isVerbose(); // Cache verbose check

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 */
export default merge(baseConfig, {
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
      path.join(__dirname, 'browserSync', 'client.config.js'),
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
        isDebug,
        extractLoader: MiniCssExtractPlugin.loader,
      }),
    ],
  },

  plugins: [
    // Define free variables
    // https://webpack.js.org/plugins/define-plugin/
    createDefinePluginConfig({
      isDebug,
      isBrowser: true, // Client bundle runs in browser
    }),

    // Loadable Components Plugin - generates loadable-stats.json for SSR
    // https://loadable-components.com/docs/api-loadable-server/
    // Output: build/loadable-stats.json (parent of output.path)
    // Server reads from: __dirname/loadable-stats.json (build/loadable-stats.json)
    new LoadablePlugin({
      filename: path.join(config.BUILD_DIR, 'loadable-stats.json'), // Write to parent dir (build/)
      writeToDisk: true, // Write to disk even in dev mode,
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
            excludeAssets: /\.map$/,
          }),
        ]
      : []),

    // Progress plugin for build feedback
    ...(BUNDLE_PROGRESS_REPORTING && verbose
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
    // Override concatenateModules with env var support
    concatenateModules:
      process.env.WEBPACK_MODULE_CONCATENATION !== 'false' && !isDebug,

    // Override usedExports with config support
    usedExports: BUNDLE_TREE_SHAKING,

    // Override sideEffects with env var support
    sideEffects: process.env.WEBPACK_SIDE_EFFECTS !== 'false',

    // Extend splitChunks with maxSize (client-specific)
    splitChunks: {
      maxSize: BUNDLE_MAX_CHUNK_SIZE,
    },

    // Minification (production only) - client-specific
    minimize: BUNDLE_MINIFICATION && !isDebug,

    // Runtime chunk - separate webpack runtime for better caching (production only)
    runtimeChunk: !isDebug ? 'single' : false,
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
