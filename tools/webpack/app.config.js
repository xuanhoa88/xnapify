/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const config = require('../config');
const { isVerbose } = require('../utils/logger');
const {
  createWebpackConfig,
  createCSSRule,
  createDefinePlugin,
  createSharedDependencies,
  isDebug,
  pkg,
} = require('./base.config');
const loadDotenv = require('./dotenv.plugin');

// Enable bundle profile
const isProfile = process.argv.includes('--profile');

// Cache verbose check
const verbose = isVerbose();

/**
 * Get the compiled server entry path from webpack output configuration
 */
const SERVER_BUNDLE_PATH = path.join(config.BUILD_DIR, 'server');

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 */
const clientConfig = createWebpackConfig('client', {
  entry: {
    client: [
      ...(isDebug
        ? [path.join(__dirname, 'browserSync', 'client.config.js')]
        : []),
      path.join(config.APP_DIR, 'client.js'),
    ],
  },
  output: {
    path: path.join(config.BUILD_DIR, 'public'),
    filename: isDebug
      ? 'assets/[name].js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].js',
    chunkFilename: isDebug
      ? 'assets/[name].chunk.js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].chunk.js',
  },
  module: {
    rules: [
      createCSSRule({
        isClient: true,
        extractLoader: MiniCssExtractPlugin.loader,
      }),
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser'),
    }),
    createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
    new webpack.container.ModuleFederationPlugin({
      name: 'host',
      shared: createSharedDependencies(pkg.dependencies || {}, {
        eager: true,
        singleton: true,
        strictVersion: false,
      }),
    }),
    new MiniCssExtractPlugin({
      filename: isDebug
        ? 'assets/[name].css'
        : 'assets-[fullhash:8]/[name].[contenthash:8].css',
      chunkFilename: isDebug
        ? 'assets/[id].css'
        : 'assets-[fullhash:8]/[id].[contenthash:8].css',
      ignoreOrder: isDebug,
    }),
    {
      apply(compiler) {
        compiler.hooks.compilation.tap('AppWrapperPlugin', compilation => {
          const { webpack: wp } = compiler;
          const { ConcatSource } = wp.sources;

          compilation.hooks.processAssets.tap(
            {
              name: 'AppWrapperPlugin',
              stage: wp.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
            },
            assets => {
              for (const [name, asset] of Object.entries(assets)) {
                // Only process main app bundles, not chunks
                if (!name.endsWith('.js') || name.includes('.chunk.')) {
                  continue;
                }

                const originalSource = asset.source();

                // Wrap the app code to init shared scope before execution
                // The host's shared scope should already be initialized, so we just
                // need to ensure it's available before the app code runs
                const wrappedSource = new ConcatSource(
                  `(function() {
  // Initialize Module Federation shared scope before app code runs
  // This is synchronous since the host already has the scope ready
  if (typeof __webpack_init_sharing__ !== 'undefined') {
    __webpack_init_sharing__('default');
  }
  // App code starts here
`,
                  originalSource,
                  `
  // App code ends here
})();
`,
                );

                compilation.updateAsset(name, wrappedSource);
              }
            },
          );
        });
      },
    },
    {
      apply(compiler) {
        compiler.hooks.done.tap('StatsWriterPlugin', stats => {
          const statsData = stats.toJson({
            all: false,
            entrypoints: true,
            assets: false,
            chunkGroups: false,
            namedChunkGroups: false,
            chunks: false,
            modules: false,
          });

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
    ...(verbose
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
});

/**
 * Configuration for the server-side bundle (server.js)
 * Targets Node.js environment with CommonJS output
 */
const serverConfig = createWebpackConfig('server', {
  entry: {
    server: [path.join(config.APP_DIR, 'server.js')],
  },
  output: {
    path: config.BUILD_DIR,
    filename: '[name].js',
    chunkFilename: 'chunks/[name].js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [createCSSRule({ isClient: false })],
  },
  plugins: [
    createDefinePlugin({
      ...loadDotenv({ prefix: 'RSK_', verbose }),
    }),
    ...(isDebug
      ? [
          new webpack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: false,
          }),
        ]
      : []),
  ].filter(Boolean),
});

// Export clientConfig, serverConfig, and SERVER_BUNDLE_PATH
module.exports = {
  clientConfig,
  serverConfig,
  SERVER_BUNDLE_PATH,
};
