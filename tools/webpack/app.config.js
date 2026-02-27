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
const {
  createCacheGroups,
  createWebpackConfig,
  createCSSRule,
  createEnvDefine,
  createProgressPlugin,
  createSharedDependencies,
  isDev,
  pkg,
} = require('./base.config');

/**
 * Get the compiled server entry path from webpack output configuration
 */
const SERVER_BUNDLE_PATH = path.join(config.BUILD_DIR, 'server');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create StatsWriterPlugin to output build stats
 * Filters out hot update files and writes minimal stats.json
 * @returns {Object} Webpack plugin object
 */
function createStatsWriterPlugin() {
  return {
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

        // Filter out hot update assets
        const filterHotUpdates = assets =>
          assets.filter(asset => {
            const name = typeof asset === 'string' ? asset : asset.name;
            return name && !/\.hot-update\./i.test(name);
          });

        // Clean entrypoints
        if (statsData.entrypoints) {
          for (const key in statsData.entrypoints) {
            if (statsData.entrypoints[key].assets) {
              statsData.entrypoints[key].assets = filterHotUpdates(
                statsData.entrypoints[key].assets,
              );
            }
          }
        }

        // Write stats to file
        fs.writeFileSync(
          path.join(config.BUILD_DIR, 'stats.json'),
          JSON.stringify(statsData, null, 2),
        );
      });
    },
  };
}

// =============================================================================
// CLIENT CONFIG
// =============================================================================

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 */
const clientConfig = createWebpackConfig('client', {
  entry: {
    client: [
      ...(isDev
        ? [path.join(__dirname, 'browserSync', 'client.config.js')]
        : []),
      path.join(config.APP_DIR, 'client.js'),
    ],
  },
  output: {
    path: path.join(config.BUILD_DIR, 'public'),
    filename: isDev
      ? 'assets/[name].js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].js',
    chunkFilename: isDev
      ? 'assets/[name].chunk.js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].chunk.js',
  },
  optimization: {
    splitChunks: {
      cacheGroups: createCacheGroups('all'),
    },
  },
  module: {
    rules: [
      createCSSRule({
        extractLoader: MiniCssExtractPlugin.loader,
      }),
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser'),
    }),
    createEnvDefine(),
    new webpack.container.ModuleFederationPlugin({
      name: 'host',
      shared: createSharedDependencies(pkg.dependencies || {}, {
        eager: true,
        singleton: true,
        strictVersion: false,
      }),
    }),
    new MiniCssExtractPlugin({
      filename: isDev
        ? 'assets/[name].css'
        : 'assets-[fullhash:8]/[name].[contenthash:8].css',
      chunkFilename: isDev
        ? 'assets/[id].css'
        : 'assets-[fullhash:8]/[id].[contenthash:8].css',
      ignoreOrder: isDev,
    }),
    createStatsWriterPlugin(),
    createProgressPlugin(),
  ].filter(Boolean),
});

// =============================================================================
// SERVER CONFIG
// =============================================================================

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
    libraryTarget: 'commonjs2',
  },

  module: {
    rules: [createCSSRule({ exportOnlyLocals: true })],
  },
  plugins: [
    createEnvDefine(),
    ...(isDev
      ? [
          new webpack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: false,
          }),
        ]
      : []),
  ],
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  clientConfig,
  serverConfig,
  SERVER_BUNDLE_PATH,
};
