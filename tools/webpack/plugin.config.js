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

// =============================================================================
// CONSTANTS
// =============================================================================

const verbose = isVerbose();
const isProfile = process.argv.includes('--profile');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create CSS Modules localIdentName for a plugin
 */
const getPluginLocalIdentName = pluginName =>
  isDebug
    ? `${pluginName}_[local]__[hash:base64:5]`
    : `${pluginName}_[hash:base64:5]`;

/**
 * Create safe library name from plugin name
 */
const getLibraryName = pluginName =>
  `plugin_${pluginName.replace(/[^a-zA-Z0-9]/g, '_')}`;

/**
 * Create ProgressPlugin for verbose builds
 */
const createProgressPlugin = () =>
  verbose
    ? new webpack.ProgressPlugin({
        activeModules: true,
        entries: true,
        modules: true,
        modulesCount: 5000,
        profile: isProfile,
        dependencies: true,
        dependenciesCount: 10000,
        percentBy: 'entries',
      })
    : null;

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
          Object.entries(assets).forEach(([name, asset]) => {
            if (!name.endsWith('.css')) return;

            const source = asset.source();
            const stripped = source.replace(/:root\s*\{[^}]*\}/g, '');

            if (source.length !== stripped.length) {
              compilation.updateAsset(
                name,
                new webpack.sources.RawSource(stripped),
              );
              if (verbose) {
                console.log(`[StripRootCSSPlugin] Removed :root from ${name}`);
              }
            }
          });
        },
      );
    });
  }
}

/**
 * Validate plugin and extract metadata
 */
function validatePlugin(plugin) {
  if (
    !plugin ||
    typeof plugin.name !== 'string' ||
    plugin.name.trim().length === 0
  ) {
    logWarn('Skipping plugin with invalid name:', plugin);
    return null;
  }

  if (!plugin.path) {
    logWarn(`Plugin "${plugin.name}" missing path`);
    return null;
  }

  if (!plugin.manifest || (!plugin.manifest.browser && !plugin.manifest.main)) {
    logWarn(`Plugin "${plugin.name}" missing UI or API entry point`);
    return null;
  }

  // Normalize plugin name
  const pluginName = plugin.manifest.name || plugin.name.trim();
  const pluginDescription = plugin.manifest.description || pluginName;

  return {
    pluginName,
    pluginDescription,
    clientPath: plugin.manifest.browser
      ? path.resolve(plugin.path, plugin.manifest.browser)
      : null,
    apiPath: plugin.manifest.main
      ? path.resolve(plugin.path, plugin.manifest.main)
      : null,
    libraryName: getLibraryName(pluginName),
  };
}

/**
 * Create shared environment definition
 */
const createEnvDefine = () =>
  createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) });

/**
 * Filter null plugins from array
 */
const filterPlugins = plugins => plugins.filter(Boolean);

// =============================================================================
// CONFIG BUILDERS
// =============================================================================

/**
 * Create client configs for plugin
 * Returns both browser (Module Federation) and server (CommonJS + CSS) builds
 */
function createClientConfig(pluginData, buildPath) {
  const { pluginName, clientPath, libraryName, pluginDescription } = pluginData;

  if (!clientPath) return [];

  const outputPath = path.join(buildPath, pluginName);
  const localIdentName = getPluginLocalIdentName(pluginName);

  const pluginDefines = createDefinePlugin({
    __PLUGIN_NAME__: JSON.stringify(pluginName),
    __PLUGIN_DESCRIPTION__: JSON.stringify(pluginDescription),
  });

  return [
    // Browser build (Module Federation)
    createWebpackConfig('client', {
      entry: clientPath,
      experiments: { outputModule: false },
      output: {
        path: outputPath,
        filename: 'browser.js',
        publicPath: 'auto',
        uniqueName: libraryName,
      },
      module: {
        rules: [
          createCSSRule({
            exportOnlyLocals: true,
            localIdentName,
          }),
        ],
      },
      plugins: filterPlugins([
        new webpack.ProvidePlugin({
          process: require.resolve('process/browser'),
        }),
        pluginDefines,
        createEnvDefine(),
        new webpack.container.ModuleFederationPlugin({
          name: libraryName,
          filename: 'remote.js',
          exposes: {
            './plugin': clientPath,
          },
          shared: createSharedDependencies(pkg.dependencies || {}, {
            eager: false,
            singleton: true,
            strictVersion: false,
          }),
        }),
        createProgressPlugin(),
      ]),
    }),

    // Server build (CommonJS + CSS extraction)
    createWebpackConfig('server', {
      entry: clientPath,
      experiments: { outputModule: false },
      output: {
        path: outputPath,
        filename: 'server.js',
        library: { type: 'commonjs' },
      },
      module: {
        rules: [
          createCSSRule({
            extractLoader: MiniCssExtractPlugin.loader,
            localIdentName,
          }),
        ],
      },
      plugins: filterPlugins([
        pluginDefines,
        createEnvDefine(),
        new MiniCssExtractPlugin({
          filename: 'plugin.css',
          ignoreOrder: isDebug,
        }),
        new StripRootCSSPlugin(),
        createProgressPlugin(),
      ]),
    }),
  ];
}

/**
 * Create API server config (if plugin has API entry)
 */
function createApiConfig(pluginData, buildPath) {
  const { pluginName, apiPath, pluginDescription } = pluginData;

  if (!apiPath) return [];

  const pluginDefines = createDefinePlugin({
    __PLUGIN_NAME__: JSON.stringify(pluginName),
    __PLUGIN_DESCRIPTION__: JSON.stringify(pluginDescription),
  });

  return [
    createWebpackConfig('server', {
      entry: apiPath,
      experiments: { outputModule: false },
      output: {
        path: path.join(buildPath, pluginName),
        filename: 'api.js',
        library: { type: 'commonjs' },
      },
      plugins: filterPlugins([
        pluginDefines,
        createEnvDefine(),
        createProgressPlugin(),
      ]),
    }),
  ];
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
function createPluginConfig({ plugins = [], buildPath }) {
  if (!Array.isArray(plugins)) {
    throw new Error('plugins must be an array');
  }

  if (typeof buildPath !== 'string' || buildPath.trim().length === 0) {
    throw new Error('buildPath must be a non-empty string');
  }

  const configs = [];

  for (const plugin of plugins) {
    const pluginData = validatePlugin(plugin);
    if (!pluginData) continue;

    // Create browser and server builds
    configs.push(...createClientConfig(pluginData, buildPath));

    // Optionally create API build
    configs.push(...createApiConfig(pluginData, buildPath));
  }

  return [...new Set(configs)];
}

module.exports = createPluginConfig;
