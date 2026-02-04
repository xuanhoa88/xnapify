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
  pkg,
  isDebug,
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
 * Custom PostCSS function to get plugins and add a plugin to strip :root
 * This prevents plugins from overriding global :root variables of the host app
 *
 * @param {Object} loader - The webpack loader context
 * @param {string} pluginName - The name of the plugin being processed
 * @returns {Array} List of PostCSS plugins
 */

/**
 * Create webpack configuration for plugins
 * @param {Object} options
 * @param {Array} options.plugins - Plugin objects to build
 * @param {string} options.buildPath - Output directory
 * @returns {Array} [clientConfig, serverConfig]
 */
function createPluginConfig({ plugins, buildPath }) {
  // Build each plugin as a separate MF container
  const clientConfigs = plugins
    .filter(p => p.manifest && p.manifest[MANIFEST_UI_ENTRY])
    .map(plugin => {
      // Plugin object has: name, path, manifest
      const pluginName = plugin.name;
      if (typeof pluginName !== 'string' || pluginName.trim().length === 0) {
        logWarn(`Skipping plugin with invalid name:`, plugin);
        return;
      }

      // Resolve entry path
      const entryPath = path.resolve(
        plugin.path,
        plugin.manifest[MANIFEST_UI_ENTRY],
      );

      // Create safe container name from plugin name
      const containerName = `plugin_${pluginName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      return createWebpackConfig('client', {
        entry: {
          // Single entry for the plugin
          plugin: entryPath,
        },
        experiments: { outputModule: false },
        output: {
          path: path.join(buildPath, pluginName),
          filename: 'browser.js',
          // MF container library format
          library: {
            type: 'var',
            name: containerName,
          },
          // Public path for loading chunks - will be set dynamically
          publicPath: 'auto',
          uniqueName: containerName,
        },
        module: {
          rules: [
            createCSSRule({
              isClient: true,
              extractLoader: MiniCssExtractPlugin.loader,
              stripRoot: true,
              localIdentName: isDebug
                ? `${pluginName}_[local]__[hash:base64:5]`
                : `${pluginName}_[hash:base64:5]`,
            }),
          ],
        },
        plugins: [
          new webpack.ProvidePlugin({
            process: require.resolve('process/browser'),
          }),
          createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
          // Configure as MF container that exposes the plugin module
          new webpack.container.ModuleFederationPlugin({
            name: containerName,
            filename: 'remoteEntry.js',
            // Expose the plugin as a module
            exposes: {
              './plugin': entryPath,
            },
            // Share React and other deps with host
            shared: createSharedDependencies(pkg.dependencies || {}, {
              eager: false,
              singleton: true,
              strictVersion: false,
            }),
          }),
          new MiniCssExtractPlugin({
            filename: '[name].[contenthash:8].css',
            chunkFilename: '[name].[contenthash:8].css',
            ignoreOrder: isDebug,
          }),
        ],
      });
    });

  const serverConfigs = plugins
    .filter(p => p.manifest && p.manifest[MANIFEST_UI_ENTRY])
    .map(plugin => {
      const pluginName = plugin.name;
      const entryPath = path.resolve(
        plugin.path,
        plugin.manifest[MANIFEST_UI_ENTRY],
      );

      // Unique entry for each plugin server bundle
      const entry = {};
      const entryName = `${pluginName}/server`
        .replace(/\.[^.\\/]+$/, '')
        .replace(/\/+/g, '/');
      entry[entryName] = entryPath;

      return createWebpackConfig('server', {
        entry,
        experiments: { outputModule: false },
        output: {
          path: buildPath,
          filename: '[name].js',
          library: { type: 'commonjs' },
        },
        module: {
          rules: [
            createCSSRule({
              isClient: false,
              stripRoot: true,
              localIdentName: isDebug
                ? `${pluginName}_[local]__[hash:base64:5]`
                : `${pluginName}_[hash:base64:5]`,
            }),
          ],
        },
        plugins: [
          createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
        ],
      });
    });

  return [...clientConfigs, ...serverConfigs];
}

// Export manifest fields for use in other modules
createPluginConfig.MANIFEST_UI_ENTRY = MANIFEST_UI_ENTRY;
createPluginConfig.MANIFEST_API_ENTRY = MANIFEST_API_ENTRY;

module.exports = createPluginConfig;
