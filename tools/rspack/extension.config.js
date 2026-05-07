/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { rspack } from '@rspack/core';
import merge from 'rspack-merge';

import { rspackConfigs } from '../factories/registry.factory.js';
import { logWarn } from '../utils/logger.js';

import {
  createCacheGroups,
  createRspackConfig,
  createWorkerConfig,
  createCSSRule,
  createDefinePlugin,
  createEnvDefine,
  createHostProvidedCSSPlugins,
  HOST_PROVIDED_CSS_MODULES,
  createProgressPlugin,
  createSharedDependencies,
  getHmrWatchIgnored,
  pkg,
  isDev,
} from './base.config.js';
import BuildManifestPlugin from './BuildManifestPlugin.js';
import StripRootCSSPlugin from './StripRootCSSPlugin.js';

const require = createRequire(import.meta.url);

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
    (!extension.manifest.browser &&
      !extension.manifest.main &&
      !extension.manifest.nodered)
  ) {
    logWarn(
      `Extension "${extension.name}" missing UI, API, or Node-RED entry point`,
    );
    return null;
  }

  // Extract manifest.nodered.nodes path for rspack entry point
  let noderedNodes = null;
  const { nodered } = extension.manifest;
  if (nodered && typeof nodered === 'object' && nodered.nodes) {
    noderedNodes = nodered.nodes;
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
    noderedPath: noderedNodes
      ? path.resolve(extension.path, noderedNodes)
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

  const clientConfig = createRspackConfig('client', {
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
      new rspack.ProvidePlugin({
        process: require.resolve('process/browser'),
      }),
      ...createHostProvidedCSSPlugins(),
      extensionDefines,
      createEnvDefine(),
      new rspack.container.ModuleFederationPlugin({
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
      new BuildManifestPlugin('remote.js'),
      new BuildManifestPlugin('browser.js'),
      createProgressPlugin(),
    ].filter(Boolean),
  });

  clientConfig.resolve.modules.unshift(
    path.join(extensionData.extensionPath, 'node_modules'),
  );

  // Server build (CommonJS + CSS extraction)
  const serverConfig = createRspackConfig('server', {
    entry: clientPath,
    experiments: { outputModule: false },
    output: {
      path: outputPath,
      filename: 'server.[contenthash:8].js',
    },
    module: {
      rules: [
        // 1. Host-provided CSS: only export CSS module locals (class names).
        // Does NOT extract the CSS content, preventing extension CSS bloat.
        createCSSRule({
          exportOnlyLocals: true,
          localIdentName,
          include: HOST_PROVIDED_CSS_MODULES,
        }),
        // 2. Extension CSS: extract content to a standalone CSS file.
        createCSSRule({
          extractLoader: rspack.CssExtractRspackPlugin.loader,
          localIdentName,
          exclude: HOST_PROVIDED_CSS_MODULES,
        }),
      ],
    },
    plugins: [
      ...createHostProvidedCSSPlugins(),
      extensionDefines,
      createEnvDefine(),
      new rspack.CssExtractRspackPlugin({
        filename: 'extension.[contenthash:8].css',
        ignoreOrder: isDev,
      }),
      new StripRootCSSPlugin(),
      new BuildManifestPlugin('server.js'),
      new BuildManifestPlugin('extension.css'),
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
  const { dirName, apiPath, extensionPath, noderedPath } = extensionData;

  if (!apiPath && !noderedPath) return [];

  const extNodeModules = path.join(extensionPath, 'node_modules');
  const outputDir = path.join(buildPath, dirName);
  const configs = [];

  // Main API server config
  if (apiPath) {
    const apiConfig = createRspackConfig('server', {
      entry: apiPath,
      experiments: { outputModule: false },
      additionalModuleDirs: [extNodeModules],
      output: {
        path: outputDir,
        filename: 'api.[contenthash:8].js',
      },
      plugins: [
        extensionDefines,
        createEnvDefine(),
        new BuildManifestPlugin('api.js'),
        createProgressPlugin(),
      ].filter(Boolean),
    });

    apiConfig.resolve.modules.unshift(extNodeModules);
    configs.push(apiConfig);

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
  }

  // Node-RED nodes: transpile each node file to standalone CJS
  if (noderedPath) {
    const nodeEntries = {};
    try {
      const files = fs.readdirSync(noderedPath, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        const match = file.name.match(/^(.+)\.[cm]?[jt]s$/i);
        if (match) {
          nodeEntries[`nodes/${match[1]}`] = {
            import: path.join(noderedPath, file.name),
            library: { type: 'commonjs' },
          };
        }
      }
    } catch {
      // Directory doesn't exist or can't be read — skip
    }

    if (Object.keys(nodeEntries).length > 0) {
      // Output nodes relative to the extension build dir
      // e.g. nodes are at "node-red/nodes" → output under "node-red/"
      const relNodered = path.relative(extensionPath, noderedPath);
      const noderedOutputDir = path.dirname(relNodered);

      const nodesCfg = createRspackConfig('server', {
        target: 'node',
        entry: nodeEntries,
        additionalModuleDirs: [extNodeModules],
        output: {
          path: path.join(outputDir, noderedOutputDir),
          filename: '[name].js',
        },
        plugins: [
          extensionDefines,
          createEnvDefine(),
          createProgressPlugin(),
        ].filter(Boolean),
      });

      nodesCfg.resolve.modules.unshift(extNodeModules);
      configs.push(nodesCfg);
    }
  }

  return configs;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create rspack configuration for extensions
 * @param {Array} extensions - Extension objects to build
 * @param {string} buildPath - Output directory
 * @returns {Array} Array of rspack configurations
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

    let extConfigs = [];

    // Create browser builds
    extConfigs.push(
      ...createClientConfig(extensionData, extensionDefines, buildPath),
    );

    // Create API + worker + Node-RED node builds
    extConfigs.push(
      ...createApiConfig(extensionData, extensionDefines, buildPath),
    );

    // use imported rspackConfigs
    const customRspack = (
      Array.isArray(rspackConfigs) ? rspackConfigs : []
    ).find(cfg => cfg.moduleDir === extensionData.extensionPath);

    if (customRspack) {
      try {
        const extensionCustomizer = require(customRspack.path);
        if (typeof extensionCustomizer === 'function') {
          extConfigs = extConfigs.map(
            config => extensionCustomizer(config, merge) || config,
          );
        } else if (typeof extensionCustomizer === 'object') {
          // Support just exporting mergeable object
          extConfigs = extConfigs.map(config =>
            merge(config, extensionCustomizer),
          );
        }
      } catch (err) {
        logWarn(
          `Skipping invalid rspack config in ${extensionData.extensionId}:`,
          err,
        );
      }
    }

    configs.push(...extConfigs);
  }

  return [...new Set(configs)];
}

export { createExtensionConfig, getHmrWatchIgnored };
