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

// Enable bundle profile
const isProfile = process.argv.includes('--profile');

/**
 * Manifest field names for plugin entry points
 * Used by both webpack config and manifest generator
 * - browser: view bundle entry (used for both client UMD and server CommonJS)
 * - api: reserved for backend/API plugin code (not built by this config)
 */
const MANIFEST_UI_ENTRY = 'browser';
const MANIFEST_API_ENTRY = 'api';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create CSS Modules localIdentName for a plugin
 * @param {string} pluginName - Plugin name
 * @returns {string} CSS Modules localIdentName pattern
 */
const getPluginLocalIdentName = pluginName =>
  isDebug
    ? `${pluginName}_[local]__[hash:base64:5]`
    : `${pluginName}_[hash:base64:5]`;

/**
 * Create ProgressPlugin for verbose builds
 * @returns {Array} Array containing ProgressPlugin or empty
 */
const createProgressPlugins = () =>
  verbose
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
    : [];

/**
 * Webpack plugin to strip :root CSS rules from final CSS assets
 */
class StripRootCSSPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('StripRootCSSPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'StripRootCSSPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        assets => {
          for (const [name, asset] of Object.entries(assets)) {
            if (name.endsWith('.css')) {
              let source = asset.source();
              const originalLength = source.length;
              source = source.replace(/:root\s*\{[^}]*\}/g, '');
              if (source.length !== originalLength) {
                compilation.updateAsset(
                  name,
                  new webpack.sources.RawSource(source),
                );
                if (verbose) {
                  console.log(
                    `[StripRootCSSPlugin] Removed :root from ${name}`,
                  );
                }
              }
            }
          }
        },
      );
    });
  }
}

/**
 * Create safe library name from plugin name
 * @param {string} pluginName - Plugin name
 * @returns {string} Safe library name for webpack
 */
const getLibraryName = pluginName =>
  `plugin_${pluginName.replace(/[^a-zA-Z0-9]/g, '_')}`;

/**
 * Validate plugin and extract common data
 * @param {Object} plugin - Plugin object with name, path, manifest
 * @returns {Object|null} Plugin data or null if invalid
 */
function validatePlugin(plugin) {
  const pluginName = plugin.name;

  if (typeof pluginName !== 'string' || pluginName.trim().length === 0) {
    logWarn(`Skipping plugin with invalid name:`, plugin);
    return null;
  }

  const entryPath = path.resolve(
    plugin.path,
    plugin.manifest[MANIFEST_UI_ENTRY],
  );
  const libraryName = getLibraryName(pluginName);

  return { pluginName, entryPath, libraryName };
}

// =============================================================================
// CLIENT CONFIG (browser.js + plugin.css)
// =============================================================================

/**
 * Create client webpack config for a plugin
 * Generates: browser.js
 */
function createClientConfig({ pluginName, entryPath, libraryName }, buildPath) {
  return createWebpackConfig('client', {
    entry: { client: entryPath },
    experiments: { outputModule: false },
    output: {
      path: path.join(buildPath, pluginName),
      filename: '[name].js',
      publicPath: 'auto',
      uniqueName: libraryName,
    },
    module: {
      rules: [
        createCSSRule({
          exportOnlyLocals: true,
          localIdentName: getPluginLocalIdentName(pluginName),
        }),
      ],
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: require.resolve('process/browser'),
      }),
      createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
      // Module Federation for sharing React with host app (outputs as browser.js)
      new webpack.container.ModuleFederationPlugin({
        name: libraryName,
        filename: 'browser.js',
        exposes: {
          './plugin': entryPath,
        },
        shared: createSharedDependencies(pkg.dependencies || {}, {
          eager: false,
          singleton: true,
          strictVersion: false,
        }),
      }),
      ...createProgressPlugins(),
    ],
  });
}

// =============================================================================
// SERVER CONFIG (server.js)
// =============================================================================

/**
 * Create server webpack config for a plugin
 * Generates: server.js, plugin.css
 */
function createServerConfig({ pluginName, entryPath }, buildPath) {
  return createWebpackConfig('server', {
    entry: { server: entryPath },
    experiments: { outputModule: false },
    output: {
      path: path.join(buildPath, pluginName),
      filename: '[name].js',
      library: { type: 'commonjs' },
    },
    module: {
      rules: [
        createCSSRule({
          extractLoader: MiniCssExtractPlugin.loader,
          localIdentName: getPluginLocalIdentName(pluginName),
        }),
      ],
    },
    plugins: [
      createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) }),
      new MiniCssExtractPlugin({
        filename: 'plugin.css',
        ignoreOrder: isDebug,
      }),
      new StripRootCSSPlugin(),
      ...createProgressPlugins(),
    ],
  });
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create webpack configuration for plugins
 * @param {Object} options
 * @param {Array} options.plugins - Plugin objects to build
 * @param {string} options.buildPath - Output directory
 * @returns {Array} Array of webpack configurations
 */
function createPluginConfig({ plugins, buildPath }) {
  const configs = [];

  // Filter plugins with UI entry
  const uiPlugins = plugins.filter(
    p => p.manifest && p.manifest[MANIFEST_UI_ENTRY],
  );

  for (const plugin of uiPlugins) {
    const pluginData = validatePlugin(plugin);
    if (!pluginData) continue;

    // Create client (browser.js + plugin.css) and server (server.js) configs
    configs.push(createClientConfig(pluginData, buildPath));
    configs.push(createServerConfig(pluginData, buildPath));
  }

  return configs;
}

// Export manifest fields for use in other modules
createPluginConfig.MANIFEST_UI_ENTRY = MANIFEST_UI_ENTRY;
createPluginConfig.MANIFEST_API_ENTRY = MANIFEST_API_ENTRY;

module.exports = createPluginConfig;
