/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');
const config = require('../config');
const { isVerbose } = require('../utils/logger');
const {
  createBaseConfig,
  createCSSRule,
  createDefinePluginConfig,
  reStyle,
  reImage,
  reFont,
  reSvg,
  isDebug,
} = require('./base.config');
const { createDotenvDefinitions } = require('./dotenv.plugin');

const verbose = isVerbose(); // Cache verbose check

/**
 * Get the compiled server entry path from webpack output configuration
 * This ensures consistent path resolution across all build tools
 * @returns {string} Absolute path to the compiled server entry (without .js extension)
 */
// Matches the output configuration below:
// output.path: config.BUILD_DIR
// output.filename: '[name].js'
// entry.server: [...]
// Result: build/server.js (require without extension)
const SERVER_BUNDLE_PATH = path.join(config.BUILD_DIR, 'server');

/**
 * Configuration for the server-side bundle (server.js)
 * Targets Node.js environment with CommonJS output
 */
const webpackServerConfig = merge(createBaseConfig('server'), {
  // Build target environment: 'node' for server-side execution
  // https://webpack.js.org/configuration/target/
  // This tells webpack to:
  // - Use Node.js built-in modules (fs, path, etc.) without bundling
  // - Generate code compatible with Node.js runtime
  // - Skip browser-specific optimizations
  target: 'node',

  // Entry point for server bundle
  // https://webpack.js.org/configuration/entry-context/
  entry: {
    // Server entry: src/server.js → build/server.js
    // This is the main Express application that handles SSR
    server: [path.join(config.APP_DIR, 'server.js')],
  },

  // Output configuration for server bundle
  // https://webpack.js.org/configuration/output/
  output: {
    // Output directory: build/
    path: config.BUILD_DIR,

    // Entry file output: build/server.js (no hash - server file doesn't need cache busting)
    filename: '[name].js',

    // Code-split chunks: build/chunks/[name].js (e.g., chunks/about.js)
    // No hash needed - server chunks are not cached by browsers
    chunkFilename: 'chunks/[name].js',

    // Export format: CommonJS2 (module.exports = ...) for Node.js require()
    // This allows the server bundle to be imported with: require('./build/server')
    libraryTarget: 'commonjs2',
  },

  // Externalize node_modules (simple and robust with webpack-node-externals)
  // Bundle CSS files, images, and fonts (they need webpack loaders)
  externals: [
    nodeExternals({
      allowlist: [
        reStyle, // All CSS/preprocessor files
        reImage, // All image formats
        reFont, // All font formats
        reSvg, // SVG files (if using SVGR)
        /^\.\.?\//, // Local relative imports
      ],
    }),
  ],

  module: {
    rules: [
      // CSS handling for server bundle (exports class names only for SSR)
      // Note: Image and font rules are inherited from baseConfig
      createCSSRule({ isClient: false }),
    ],
  },

  plugins: [
    // Define free variables
    // https://webpack.js.org/plugins/define-plugin/
    createDefinePluginConfig({
      // Inject RSK_ prefixed environment variables
      ...createDotenvDefinitions({ prefix: 'RSK_', verbose }),
    }),

    // Inject source-map-support at the top of the bundle (development only)
    // This provides better stack traces for debugging without requiring manual imports
    ...(isDebug
      ? [
          new webpack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: false,
          }),
        ]
      : []),

    // Note: Worker files are now imported directly via require.context
    // No separate bundling needed since they run in the same process
  ].filter(Boolean),

  // Do not replace node globals with polyfills
  // https://webpack.js.org/configuration/node/
  // In webpack 5, only __dirname, __filename, and global are valid
  node: {
    __dirname: false,
    __filename: false,
    global: false,
  },
});

module.exports = {
  webpackServerConfig,
  SERVER_BUNDLE_PATH,
};
