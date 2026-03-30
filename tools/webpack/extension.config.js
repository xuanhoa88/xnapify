/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

const { logWarn } = require('../utils/logger');

const {
  createCacheGroups,
  createWebpackConfig,
  createCSSRule,
  createDefinePlugin,
  createEnvDefine,
  createProgressPlugin,
  createSharedDependencies,
  pkg,
  isDev,
  verbose,
} = require('./base.config');

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
 * Validate extension and extract metadata
 */
function validateExtension(extension) {
  if (
    !extension ||
    typeof extension.name !== 'string' ||
    extension.name.trim().length === 0
  ) {
    logWarn('Skipping extension with invalid name:', extension);
    return null;
  }

  if (!extension.path) {
    logWarn(`Extension "${extension.name}" missing path`);
    return null;
  }

  if (
    !extension.manifest ||
    (!extension.manifest.browser && !extension.manifest.main)
  ) {
    logWarn(`Extension "${extension.name}" missing UI or API entry point`);
    return null;
  }

  const { dirName } = extension;

  return {
    extensionName: extension.name,
    extensionPath: extension.path,
    extensionDescription: extension.manifest.description || extension.name,
    dirName,
    clientPath: extension.manifest.browser
      ? path.resolve(extension.path, extension.manifest.browser)
      : null,
    apiPath: extension.manifest.main
      ? path.resolve(extension.path, extension.manifest.main)
      : null,
    libraryName: `extension_${dirName}`,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create CSS Modules localIdentName for an extension
 */
const getExtensionLocalIdentName = extensionName =>
  isDev
    ? `${extensionName}_[local]__[hash:base64:5]`
    : `${extensionName}_[hash:base64:5]`;

// =============================================================================
// CONFIG BUILDERS
// =============================================================================

/**
 * Create client configs for extension
 * Returns both browser (Module Federation) and server (CommonJS + CSS) builds
 */
function createClientConfig(extensionData, extensionDefines, buildPath) {
  const { dirName, clientPath, libraryName } = extensionData;

  if (!clientPath) return [];

  const outputPath = path.join(buildPath, dirName);
  const localIdentName = getExtensionLocalIdentName(dirName);

  const clientConfig = createWebpackConfig('client', {
    entry: clientPath,
    experiments: { outputModule: false },
    output: {
      path: outputPath,
      filename: 'browser.js',
      chunkFilename: isDev
        ? '[name].chunk.js'
        : '[name].[contenthash:8].chunk.js',
      publicPath: 'auto',
      uniqueName: libraryName,
    },
    optimization: {
      runtimeChunk: false, // remotes must not emit a separate runtime
      splitChunks: {
        chunks: 'async',
        cacheGroups: createCacheGroups('async'),
      },
    },
    performance: false, // extensions are async remotes — size hints not meaningful
    module: {
      rules: [
        createCSSRule({
          exportOnlyLocals: true,
          localIdentName,
        }),
      ],
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: require.resolve('process/browser'),
      }),
      extensionDefines,
      createEnvDefine(),
      new webpack.container.ModuleFederationPlugin({
        name: libraryName,
        filename: 'remote.js',
        exposes: {
          './extension': clientPath,
        },
        shared: createSharedDependencies(pkg.dependencies || {}, {
          eager: false,
          singleton: true,
          strictVersion: false,
        }),
      }),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  clientConfig.resolve.modules.unshift(
    path.join(extensionData.extensionPath, 'node_modules'),
  );

  // Server build (CommonJS + CSS extraction)
  const serverConfig = createWebpackConfig('server', {
    entry: clientPath,
    experiments: { outputModule: false },
    output: {
      path: outputPath,
      filename: 'server.js',
    },
    module: {
      rules: [
        createCSSRule({
          extractLoader: MiniCssExtractPlugin.loader,
          localIdentName,
        }),
      ],
    },
    plugins: [
      extensionDefines,
      createEnvDefine(),
      new MiniCssExtractPlugin({
        filename: 'extension.css',
        ignoreOrder: isDev,
      }),
      new StripRootCSSPlugin(),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  serverConfig.resolve.modules.unshift(
    path.join(extensionData.extensionPath, 'node_modules'),
  );

  return [clientConfig, serverConfig];
}

/**
 * Create API server config (if extension has API entry)
 */
function createApiConfig(extensionData, extensionDefines, buildPath) {
  const { dirName, apiPath } = extensionData;

  if (!apiPath) return [];

  const apiConfig = createWebpackConfig('server', {
    entry: apiPath,
    experiments: { outputModule: false },
    output: {
      path: path.join(buildPath, dirName),
      filename: 'api.js',
    },
    plugins: [
      extensionDefines,
      createEnvDefine(),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  apiConfig.resolve.modules.unshift(
    path.join(extensionData.extensionPath, 'node_modules'),
  );

  return [apiConfig];
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create webpack configuration for extensions
 * @param {Object} options
 * @param {Array} options.extensions - Extension objects to build
 * @param {string} options.buildPath - Output directory
 * @returns {Array} Array of webpack configurations
 */
function createExtensionConfig({ extensions = [], buildPath }) {
  if (!Array.isArray(extensions)) {
    throw new Error('extensions must be an array');
  }

  if (typeof buildPath !== 'string' || buildPath.trim().length === 0) {
    throw new Error('buildPath must be a non-empty string');
  }

  const configs = [];

  for (const extension of extensions) {
    const extensionData = validateExtension(extension);
    if (!extensionData) continue;

    // Create shared extension defines once
    const extensionDefines = createDefinePlugin({
      __EXTENSION_NAME__: JSON.stringify(extensionData.extensionName),
      __EXTENSION_DESCRIPTION__: JSON.stringify(
        extensionData.extensionDescription,
      ),
    });

    // Create browser and server builds
    configs.push(
      ...createClientConfig(extensionData, extensionDefines, buildPath),
    );

    // Optionally create API build
    configs.push(
      ...createApiConfig(extensionData, extensionDefines, buildPath),
    );
  }

  return [...new Set(configs)];
}

module.exports = createExtensionConfig;
