/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { logWarn, isVerbose } = require('../utils/logger');
const {
  createWebpackConfig,
  createCSSRule,
  createDefinePlugin,
  createSharedDependencies,
  clientExternals,
  pkg,
} = require('./base.config');
const loadDotenv = require('./dotenv.plugin');

// Cache verbose check for use throughout the build
const verbose = isVerbose();

/**
 * Manifest field names for plugin entry points
 * Used by both webpack config and manifest generator
 * - browser: view bundle entry (used for both client UMD and server CommonJS)
 * - main: reserved for backend/API plugin code (not built by this config)
 */
const MANIFEST_UI_ENTRY = 'browser';
const MANIFEST_API_ENTRY = 'main';

/**
 * Build entry points from plugin manifests
 * @param {Array<{name: string, path: string, manifest: Object}>} plugins - Array of plugin objects
 * @param {'browser'} field - Manifest field to use
 * @param {string} outputName - Output file name (e.g., 'browser' or 'ssr')
 * @returns {Object<string, string>} Webpack entry configuration mapping entry names to file paths
 * @throws {Error} If duplicate entries are detected or invalid plugin data is found
 */
function getEntry(plugins, field, outputName = field) {
  if (!Array.isArray(plugins)) {
    throw new TypeError('plugins must be an array');
  }

  if (typeof field !== 'string' || field.length === 0) {
    throw new TypeError('field must be a non-empty string');
  }

  const entries = Object.create(null);

  for (const plugin of plugins) {
    // Skip invalid plugins
    if (!plugin || typeof plugin !== 'object') {
      continue;
    }

    const { name, path: pluginPath, manifest } = plugin;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      logWarn(`Skipping plugin with invalid name:`, plugin);
      continue;
    }

    if (!pluginPath || typeof pluginPath !== 'string') {
      logWarn(`Skipping plugin "${name}" with invalid path`);
      continue;
    }

    if (!manifest || typeof manifest !== 'object') {
      logWarn(`Skipping plugin "${name}" with invalid manifest`);
      continue;
    }

    const mainEntry = manifest[field];

    // Skip if entry field doesn't exist or isn't a string
    if (typeof mainEntry !== 'string' || mainEntry.trim().length === 0) {
      continue;
    }

    // Use outputName for the entry key (determines output filename)
    // e.g. "test-plugin/browser" -> "test-plugin/browser.js"
    const entryName = `${name}/${outputName}`
      .replace(/\.[^.\\/]+$/, '') // remove last file extension
      .replace(/\/+/g, '/'); // replace multiple slashes with single slash

    // Check for duplicates
    if (entries[entryName]) {
      throw new Error(
        `Duplicate entry "${entryName}" detected from plugins: ` +
          `existing path "${entries[entryName]}", ` +
          `new path "${path.resolve(pluginPath, mainEntry)}"`,
      );
    }

    entries[entryName] = path.resolve(pluginPath, mainEntry);
  }

  return entries;
}

/**
 * Create webpack configuration for plugins
 * @param {Object} options
 * @param {Array} options.plugins - Plugin objects to build
 * @param {string} options.buildPath - Output directory
 * @returns {Array} [clientConfig, serverConfig]
 */
function createPluginConfig({ plugins, buildPath }) {
  const clientConfig = createWebpackConfig('client', {
    entry: getEntry(plugins, MANIFEST_UI_ENTRY),
    experiments: { outputModule: false },
    output: {
      path: buildPath,
      filename: '[name].js',
      library: {
        type: 'window',
        name: ['__rsk__plugins__', '[name]'], // Assigns to window.__rsk__plugins__['plugin-id/browser']
      },
      // Ensure the bundle doesn't conflict
      uniqueName: '[name]',
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
        name: 'plugin_consumers',
        shared: createSharedDependencies(
          Object.fromEntries(
            Object.entries(pkg.dependencies || {}).filter(
              ([dep]) => !clientExternals[dep],
            ),
          ),
          {
            eager: true,
            singleton: true,
            strictVersion: false,
          },
        ),
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
    ],
    // Disable code splitting and runtime chunk
    // Plugins should be single-file bundles that rely on host's shared dependencies
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
    },
    // Use externals for core libraries to ensure singletons (MF eager:true breaks singletons for sync entries)
    // Use dynamic externals to delegate shared dependencies to the host
    externals: clientExternals,
  });

  const serverConfig = createWebpackConfig('server', {
    // Use 'browser' field but output to 'server.js' for server bundle
    entry: getEntry(plugins, MANIFEST_UI_ENTRY, 'server'),
    experiments: { outputModule: false },
    output: {
      path: buildPath,
      filename: '[name].js',
      library: { type: 'commonjs' },
    },
    module: {
      rules: [createCSSRule({ isClient: false })],
    },
    plugins: [
      createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
    ],
  });

  return [clientConfig, serverConfig];
}

// Export manifest fields for use in other modules
createPluginConfig.MANIFEST_UI_ENTRY = MANIFEST_UI_ENTRY;
createPluginConfig.MANIFEST_API_ENTRY = MANIFEST_API_ENTRY;

module.exports = createPluginConfig;
