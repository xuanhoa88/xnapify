/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const config = require('../config');
const { isVerbose } = require('../utils/logger');
const {
  createBaseConfig,
  createCSSRule,
  createDefinePluginConfig,
  isAnalyze,
  isDebug,
  isProfile,
} = require('./base.config');

const verbose = isVerbose(); // Cache verbose check

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 */
module.exports = merge(createBaseConfig('client'), {
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

    // Generate stats file for SSR asset injection
    {
      apply(compiler) {
        compiler.hooks.done.tap('StatsWriterPlugin', stats => {
          const statsData = stats.toJson({
            all: false,
            entrypoints: true,
            assets: true, // Only need asset filenames
            chunkGroups: false,
            namedChunkGroups: false,
            chunks: false,
            modules: false,
          });

          // Filter out hot-update files from entrypoints/namedChunkGroups
          // Note: excludeAssets only filters top-level assets array, not nested ones
          const filterHotUpdates = assets =>
            assets.filter(asset => {
              const name = typeof asset === 'string' ? asset : asset.name;
              return name && !/\.hot-update\./i.test(name);
            });

          if (statsData.entrypoints) {
            for (const key in statsData.entrypoints) {
              if (statsData.entrypoints[key].assets) {
                statsData.entrypoints[key].assets = filterHotUpdates(
                  statsData.entrypoints[key].assets,
                );
              }
            }
          }

          if (statsData.namedChunkGroups) {
            for (const key in statsData.namedChunkGroups) {
              if (statsData.namedChunkGroups[key].assets) {
                statsData.namedChunkGroups[key].assets = filterHotUpdates(
                  statsData.namedChunkGroups[key].assets,
                );
              }
            }
          }

          fs.writeFileSync(
            path.join(config.BUILD_DIR, 'stats.json'),
            JSON.stringify(statsData, null, 2),
          );
        });
      },
    },

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

    // Note: ReactRefreshWebpackPlugin is added by dev.js for development mode
    // This avoids duplicate plugin instances which cause HMR conflicts

    // Webpack Bundle Analyzer (production only)
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    ...(isAnalyze && !isDebug
      ? [
          new BundleAnalyzerPlugin({
            // Mode: 'static' generates HTML report, 'json' for CI, 'server' for interactive
            analyzerMode: config.env('BUNDLE_ANALYZER_MODE', 'static'),

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
            openAnalyzer: config.env('BUNDLE_ANALYZER_OPEN') === 'true',

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
  optimization: {
    runtimeChunk: !isDebug ? 'single' : false,

    // Code splitting - Smart Granular Caching (CLIENT ONLY)
    // Server doesn't benefit from browser caching or HTTP/2
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20_000,
      cacheGroups: {
        // Robust Vendor Splitting: Auto-generates chunk names based on package name
        // e.g. "vendor.react.js", "vendor.lodash.js"
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: 20,
          reuseExistingChunk: true,
          name(module) {
            // 1. Check if it's a virtual module (no node_modules in path)
            if (!module.context.includes('node_modules')) {
              return 'vendor.virtual';
            }

            // Robust extraction for all package managers (npm, yarn, pnpm)
            // 2. Get all path segments inside node_modules
            const segments = module.context.split(/[\\/]node_modules[\\/]/);

            // 3. Take the last segment (closest to the file) to handle pnpm/nested deps
            let packageName = segments[segments.length - 1].split(/[\\/]/)[0];

            // 4. Handle scoped packages (@scope/pkg)
            if (packageName.startsWith('@')) {
              const parts = segments[segments.length - 1].split(/[\\/]/);
              if (parts.length > 1) {
                packageName = `${parts[0]}/${parts[1]}`;
              }
            }

            // 5. Sanitize name
            return `vendor.${packageName.replace('@', '').replace('/', '-')}`;
          },
        },
        // Commons: Shared app code
        commons: {
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
          chunks: 'async',
        },
        // Styles: MONOLITHIC CSS to prevent FOUC
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
          priority: +Infinity,
        },
      },
    },
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
