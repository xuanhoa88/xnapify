/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

const config = require('../config');

const AsyncModuleFederationPlugin = require('./AsyncModuleFederationPlugin');
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
 * Webpack plugin that writes a minimal stats.json containing only the asset
 * filenames needed by the SSR template to emit <script>, <link rel="stylesheet">,
 * and <link rel="preload"> tags.
 *
 * Filters out hot-update chunks, source maps, and duplicate entries.
 * Includes both entry assets AND preloaded child chunks so that the SSR
 * template can emit <link rel="preload"> for async client bundles produced
 * by the Module Federation bootstrap wrapper.
 *
 * Output shape:
 *   { "scripts": ["main.abc123.js"], "stylesheets": ["main.abc123.css"] }
 *
 * @returns {import('webpack').WebpackPluginInstance}
 */
function createStatsWriterPlugin() {
  return {
    apply(compiler) {
      compiler.hooks.done.tap('StatsWriterPlugin', stats => {
        try {
          const statsData = stats.toJson({
            all: false,
            entrypoints: true,
            assets: true,
            chunkGroups: true,
            namedChunkGroups: true,
            chunks: false,
            modules: false,
          });

          if (stats.hasErrors()) {
            console.warn(
              '[StatsWriterPlugin] Build has errors — stats.json may be incomplete.',
            );
          }

          const scripts = new Set();
          const stylesheets = new Set();

          const isHotUpdate = name => /\.hot-update\./i.test(name);
          const isSourceMap = name => name.endsWith('.map');
          const isScript = name => name.endsWith('.js');
          const isStylesheet = name => name.endsWith('.css');

          const addAsset = asset => {
            const name =
              typeof asset === 'object' && asset.name ? asset.name : asset;
            if (!name || isHotUpdate(name) || isSourceMap(name)) return;
            if (isScript(name)) scripts.add(name);
            if (isStylesheet(name)) stylesheets.add(name);
          };

          // 1. Ordered assets from the client entrypoint (preserves load order).
          const clientEntry =
            (statsData.entrypoints && statsData.entrypoints.client) || null;
          if (clientEntry) {
            (clientEntry.assets || []).forEach(addAsset);

            // Preloaded child chunks (e.g. async MF bootstrap wrapper).
            (
              (clientEntry.childAssets && clientEntry.childAssets.preload) ||
              []
            ).forEach(addAsset);
          } else {
            console.warn(
              '[StatsWriterPlugin] No "client" entrypoint found in stats — scripts will be empty.',
            );
          }

          // 2. CSS safety net: sweep all emitted assets for any CSS not already
          //    captured above (e.g. async-imported CSS chunks). This prevents FOUC
          //    when MiniCssExtractPlugin emits chunks outside the main entrypoint.
          (statsData.assets || []).forEach(asset => {
            const name = (typeof asset === 'object' && asset.name) || asset;
            if (name && isStylesheet(name) && !isHotUpdate(name)) {
              stylesheets.add(name);
            }
          });

          const output = {
            scripts: Array.from(scripts),
            stylesheets: Array.from(stylesheets),
          };

          const outPath = path.join(config.BUILD_DIR, 'stats.json');
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
        } catch (err) {
          // Surface the error without silently swallowing it — a missing or
          // malformed stats.json will break SSR at runtime, so fail loudly.
          console.error('[StatsWriterPlugin] Failed to write stats.json:', err);
          throw err;
        }
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
 *
 * Uses an async bootstrap entry (src/bootstrap/client.js) to create
 * a Module Federation async boundary — shared modules like i18next
 * and react-i18next are fully initialized before the app code runs.
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
    new AsyncModuleFederationPlugin(),
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
