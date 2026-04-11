/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

const config = require('../config');
const { isVerbose, logInfo, logWarn } = require('../utils/logger');

const AsyncModuleFederationPlugin = require('./AsyncModuleFederationPlugin');
const {
  createCacheGroups,
  createWebpackConfig,
  createWorkerConfig,
  createCSSRule,
  createEnvDefine,
  createHostProvidedCSSPlugins,
  createProgressPlugin,
  createSharedDependencies,
  getHmrWatchIgnored,
  isDev,
  pkg,
} = require('./base.config');
const StatsManifestPlugin = require('./StatsManifestPlugin');

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
  return new StatsManifestPlugin({
    filename: path.join(config.BUILD_DIR, 'stats.json'),
    incremental: false,
    ignoreErrors: false,
    statsOptions: {
      all: false,
      entrypoints: true,
      assets: true,
      chunkGroups: true,
      namedChunkGroups: true,
      chunks: false,
      modules: false,
    },
    transform: statsData => {
      const scripts = new Set();
      const stylesheets = new Set();

      const isHotUpdate = name => /\.hot-update\./i.test(name);
      const isSourceMap = name => name.endsWith('.map');
      const isScript = name => name.endsWith('.js');
      const isStylesheet = name => name.endsWith('.css');

      const addAsset = asset => {
        const name =
          typeof asset === 'object' && asset !== null && asset.name
            ? asset.name
            : asset;
        if (
          !name ||
          typeof name !== 'string' ||
          isHotUpdate(name) ||
          isSourceMap(name)
        )
          return;
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
        const name =
          typeof asset === 'object' && asset !== null && asset.name
            ? asset.name
            : asset;
        if (
          name &&
          typeof name === 'string' &&
          isStylesheet(name) &&
          !isHotUpdate(name)
        ) {
          stylesheets.add(name);
        }
      });

      return {
        scripts: Array.from(scripts),
        stylesheets: Array.from(stylesheets),
      };
    },
  });
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
    ...createHostProvidedCSSPlugins(),
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
// WORKER CONFIGS (Core Apps)
// =============================================================================

/**
 * Discover and compile worker files from all core app modules.
 * Each app gets a unique webpack compiler name (`workers-<appName>`) so the
 * dev server can watch them independently.
 *
 * Scans `src/apps/<appName>/api/workers/` directories.
 * Output: `BUILD_DIR/workers/<appName>/<name>.worker.js`
 */
const workerConfig = (() => {
  const configs = [];

  try {
    const appsDir = path.join(config.APP_DIR, 'apps');
    const appDirs = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const appDir of appDirs) {
      // Skip files, hidden dirs, and route-group dirs like (default)
      if (
        !appDir.isDirectory() ||
        appDir.name.startsWith('.') ||
        appDir.name.startsWith('(')
      )
        continue;

      configs.push(
        createWorkerConfig({
          workersDir: path.join(appsDir, appDir.name, 'api', 'workers'),
          outputPath: config.BUILD_DIR,
          prefix: `workers/${appDir.name}`,
          name: `workers-${appDir.name}`,
        }),
      );
    }
  } catch (err) {
    // Missing apps directory is expected — anything else should be surfaced
    if (err.code !== 'ENOENT') {
      logWarn(`⚠️ Failed to scan app workers: ${err.message}`);
    }
  }

  const result = configs.filter(Boolean);

  if (isVerbose() && result.length > 0) {
    logInfo(
      `🔧 Discovered ${result.length} worker compiler(s): ${result.map(c => c.name).join(', ')}`,
    );
  }

  return result;
})();

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  clientConfig,
  serverConfig,
  workerConfig,
  getHmrWatchIgnored,
};
