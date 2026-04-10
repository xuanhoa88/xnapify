/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

const { logWarn } = require('../utils/logger');

const {
  createCacheGroups,
  createWebpackConfig,
  createWorkerConfig,
  createCSSRule,
  createDefinePlugin,
  createEnvDefine,
  createHostProvidedCSSPlugins,
  createProgressPlugin,
  createSharedDependencies,
  getHmrWatchIgnored,
  reStyle,
  reImage,
  reFont,
  reSvg,
  pkg,
  isDev,
  verbose,
} = require('./base.config');
const StatsManifestPlugin = require('./StatsManifestPlugin');

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
 * Webpack plugin that writes a stats.json after each compilation.
 * Maps logical filenames (e.g. 'api.js') to their content-hashed physical
 * filenames (e.g. 'api.a1b2c3d4.js'). This enables runtime resolution of
 * extension bundles without hardcoded filenames, solving browser and Node.js
 * caching issues.
 *
 * Each compilation config should specify `logicalName` in the plugin
 * constructor to define which logical name this build's output maps to.
 */
class BuildManifestPlugin extends StatsManifestPlugin {
  /**
   * @param {Object} options
   * @param {string} options.logicalName - Logical filename key (e.g. 'api.js')
   */
  constructor({ logicalName }) {
    super({
      filename: 'stats.json',
      incremental: true,
      ignoreErrors: false,
      statsOptions: { all: false, assets: true },
      transform: (statsData, manifest) => {
        // Find the emitted asset matching this logical name's base
        // e.g. logicalName='api.js' matches 'api.a1b2c3d4.js'
        const logicalBase = logicalName.replace(/\.[^.]+$/, ''); // 'api'
        const logicalExt = path.extname(logicalName); // '.js'

        const assets = (statsData.assets || [])
          .map(a => (typeof a === 'string' ? a : a && a.name))
          .filter(Boolean);

        // Match pattern: <logicalBase>.<hash><logicalExt>
        const hashPattern = new RegExp(
          `^${logicalBase}\\.[a-f0-9]{8}\\${logicalExt}$`,
        );
        const matched = assets.find(name => hashPattern.test(name));

        if (matched) {
          manifest[logicalName] = matched;
        } else {
          // Fallback: exact match (for non-hashed builds)
          const exact = assets.find(name => name === logicalName);
          if (exact) manifest[logicalName] = exact;
        }

        manifest.builtAt = Date.now();

        if (verbose) {
          console.log(
            `[BuildManifestPlugin] ${logicalName} → ${manifest[logicalName] || '(not found)'}`,
          );
        }

        return manifest;
      },
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
  // MF library name must be a valid JS identifier — use the sqid-based id
  // (e.g. 'extension_TJO7Yw61SwQzV'), not the scoped manifest name.
  const extensionId = extension.id || dirName;

  return {
    extensionName: extension.name,
    extensionPath: extension.path,
    extensionDescription: extension.manifest.description || extension.name,
    dirName,
    extensionId,
    clientPath: extension.manifest.browser
      ? path.resolve(extension.path, extension.manifest.browser)
      : null,
    apiPath: extension.manifest.main
      ? path.resolve(extension.path, extension.manifest.main)
      : null,
    libraryName: `extension_${extensionId}`,
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
  const localIdentName = getExtensionLocalIdentName(extensionData.extensionId);

  const clientConfig = createWebpackConfig('client', {
    entry: clientPath,
    experiments: { outputModule: false },
    output: {
      path: outputPath,
      filename: 'browser.[contenthash:8].js',
      chunkFilename: '[name].[contenthash:8].chunk.js',
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
      ...createHostProvidedCSSPlugins(),
      extensionDefines,
      createEnvDefine(),
      new webpack.container.ModuleFederationPlugin({
        name: libraryName,
        filename: 'remote.[contenthash:8].js',
        exposes: {
          './extension': clientPath,
        },
        shared: createSharedDependencies(pkg.dependencies || {}, {
          eager: false,
          singleton: true,
          strictVersion: false,
        }),
      }),
      new BuildManifestPlugin({ logicalName: 'remote.js' }),
      new BuildManifestPlugin({ logicalName: 'browser.js' }),
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
      filename: 'server.[contenthash:8].js',
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
      ...createHostProvidedCSSPlugins(),
      extensionDefines,
      createEnvDefine(),
      new MiniCssExtractPlugin({
        filename: 'extension.[contenthash:8].css',
        ignoreOrder: isDev,
      }),
      new StripRootCSSPlugin(),
      new BuildManifestPlugin({ logicalName: 'server.js' }),
      new BuildManifestPlugin({ logicalName: 'extension.css' }),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  serverConfig.resolve.modules.unshift(
    path.join(extensionData.extensionPath, 'node_modules'),
  );

  return [clientConfig, serverConfig];
}

/**
 * Create API server config and worker configs (if extension has API entry)
 */
function createApiConfig(extensionData, extensionDefines, buildPath) {
  const { dirName, apiPath, extensionPath } = extensionData;

  if (!apiPath) return [];

  const extNodeModules = path.join(extensionPath, 'node_modules');
  const outputDir = path.join(buildPath, dirName);

  const apiConfig = createWebpackConfig('server', {
    entry: apiPath,
    experiments: { outputModule: false },
    externals: [
      nodeExternals({
        additionalModuleDirs: [extNodeModules],
        allowlist: [reStyle, reImage, reFont, reSvg, /^\.\.\?\//],
      }),
    ],
    output: {
      path: outputDir,
      filename: 'api.[contenthash:8].js',
    },
    plugins: [
      extensionDefines,
      createEnvDefine(),
      new BuildManifestPlugin({ logicalName: 'api.js' }),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  apiConfig.resolve.modules.unshift(extNodeModules);

  const configs = [apiConfig];

  // Compile workers as standalone CJS modules
  const workerCfg = createWorkerConfig({
    workersDir: path.join(path.dirname(apiPath), 'workers'),
    outputPath: outputDir,
    name: `workers-${dirName}`,
    additionalModuleDirs: [extNodeModules],
    plugins: [extensionDefines, createProgressPlugin()],
  });
  if (workerCfg) {
    configs.push(workerCfg);
  }

  return configs;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create webpack configuration for extensions
 * @param {Array} extensions - Extension objects to build
 * @param {string} buildPath - Output directory
 * @returns {Array} Array of webpack configurations
 */
function createExtensionConfig(extensions = [], buildPath) {
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
      __EXTENSION_ID__: JSON.stringify(extensionData.extensionId),
      __EXTENSION_DESCRIPTION__: JSON.stringify(
        extensionData.extensionDescription,
      ),
    });

    // Create browser builds
    configs.push(
      ...createClientConfig(extensionData, extensionDefines, buildPath),
    );

    // Create API + worker builds
    configs.push(
      ...createApiConfig(extensionData, extensionDefines, buildPath),
    );
  }

  return [...new Set(configs)];
}

module.exports = { createExtensionConfig, getHmrWatchIgnored };
