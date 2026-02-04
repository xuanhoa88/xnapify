/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { default: merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');
const config = require('../config');

// Get package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(config.CWD, 'package.json'), 'utf8'),
);

// Base webpack configuration
const nodeEnv = config.env('NODE_ENV', 'development');
const isDebug = nodeEnv !== 'production';

// JavaScript/TypeScript files (including ES modules and CommonJS)
const reScript = /\.[cm]?[jt]sx?$/i;

// Styles
const reStyle = /\.(?:css|s[ac]ss|less|styl|sss)(?:\?.*)?$/i;

// Images
const reImage = /\.(?:ico|gif|png|jpe?g|webp|bmp|avif)(?:\?.*)?$/i;

// Fonts
const reFont = /\.(?:woff2?|eot|ttf|otf)(?:\?.*)?$/i;

// SVG (handled separately)
const reSvg = /\.svg(?:\?.*)?$/i;

// HTML
const reHtml = /\.(?:html?|htm)(?:\?.*)?$/i;

// Markdown
const reMarkdown = /\.(?:md|markdown)(?:\?.*)?$/i;

// Text
const reText = /\.txt(?:\?.*)?$/i;

// Media
const reAudio = /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?.*)?$/i;
const reVideo = /\.(?:mp4|webm|ogv|mov|avi|mkv)(?:\?.*)?$/i;

// Data
const reData = /\.(?:json|xml|csv|ya?ml)(?:\?.*)?$/i;

/**
 * Convert strings OR package names to safe PascalCase
 *
 * Supports:
 * - camelCase
 * - snake_case
 * - kebab-case
 * - dotted.case
 * - scoped packages (@scope/pkg-name)
 */
function toPascalCase(input) {
  if (typeof input !== 'string' || !input) return '';

  return (
    input
      // Handle scoped packages: @scope/pkg → scope pkg
      .replace(/^@/, '')
      .replace(/[/]+/g, ' ')
      // Split camelCase / PascalCase
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      // Normalize separators
      .replace(/[_\-.]+/g, ' ')
      // Normalize case
      .toLowerCase()
      // Capitalize words
      .replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase())
      // Remove spaces
      .replace(/\s+/g, '')
  );
}

/**
 * Get file naming pattern based on environment
 */
const getFileNamePattern = (hashType = 'hash') =>
  isDebug ? '[path][name][ext]' : `[${hashType}:8][ext]`;

/**
 * Create CSS loader configuration for webpack
 * Supports CSS, SCSS, SASS, and LESS with CSS Modules
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.isClient - True for client bundle, false for server
 * @param {any} options.extractLoader - MiniCssExtractPlugin.loader for client (optional)
 * @returns {Object} Webpack rule configuration
 */
const createCSSRule = ({
  isClient,
  extractLoader,
  postcssPlugins,
  localIdentName,
}) => {
  // Common CSS loader options
  const cssLoaderOptions = {
    importLoaders: 1, // Will be dynamically adjusted per preprocessor
    sourceMap: isDebug,
    esModule: false,
    modules: {
      // Enable CSS Modules only for files in src/ directory
      auto: resourcePath => resourcePath.includes(config.APP_DIR),
      // Server: only export class names, Client: full CSS
      exportOnlyLocals: !isClient,
      localIdentName:
        localIdentName ||
        (isDebug ? '[name]-[local]-[hash:base64:5]' : '[hash:base64:5]'),
    },
  };

  // PostCSS loader options
  const postcssLoaderOptions = {
    sourceMap: isDebug,
    postcssOptions: {
      // Use config file
      config: path.resolve(__dirname, '..', 'postcss.config.js'),
      // SugarSS parser (for .sss files)
      parser: file => (file && file.endsWith('.sss') ? 'sugarss' : undefined),
    },
  };

  // Helper to build loader chain (executed right-to-left)
  const buildLoaders = (preprocessor = null) => {
    const loaders = [
      {
        loader: 'css-loader',
        options: {
          ...cssLoaderOptions,
          // Adjust importLoaders based on number of loaders after css-loader
          importLoaders: preprocessor ? 2 : 1,
        },
      },
      {
        loader: 'postcss-loader',
        options: postcssLoaderOptions,
      },
    ];

    // Add preprocessor loader at the end (executes first)
    if (preprocessor) {
      loaders.push(preprocessor);
    }

    // Add extractLoader at the beginning (executes last)
    if (extractLoader) {
      loaders.unshift(extractLoader);
    }

    return loaders;
  };

  // Return rule with oneOf for different file types
  return {
    test: reStyle,
    oneOf: [
      // SCSS/SASS
      {
        test: /\.s[ac]ss$/i,
        use: buildLoaders({
          loader: 'sass-loader',
          options: { sourceMap: isDebug },
        }),
      },

      // LESS
      {
        test: /\.less$/i,
        use: buildLoaders({
          loader: 'less-loader',
          options: { sourceMap: isDebug },
        }),
      },

      // Stylus
      {
        test: /\.styl$/i,
        use: buildLoaders({
          loader: 'stylus-loader',
          options: { sourceMap: isDebug },
        }),
      },

      // Plain CSS (must be last in oneOf)
      {
        use: buildLoaders(),
      },
    ],
  };
};

/**
 * Create webpack.DefinePlugin instance
 * Defines global constants that can be configured at compile time
 *
 * @param {Object} extraDefinitions - Additional definitions to merge (optional)
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
const createDefinePlugin = extraDefinitions =>
  new webpack.DefinePlugin({
    // Development flag - used for dev-only code (logging, debugging, etc.)
    __DEV__: !!isDebug,
    // Merge any additional definitions (e.g., RSK_ env vars for server)
    ...extraDefinitions,
  });

/**
 * Create shared dependencies configuration for Module Federation
 * @param {Object} pkg - package.json object
 * @param {Object} options - Configuration options
 * @param {boolean} [options.eager=false] - Load all dependencies eagerly
 * @param {string[]} [options.eagerDeps=[]] - Specific dependencies to load eagerly
 * @param {boolean} [options.singleton=true] - Make all dependencies singleton
 * @param {string[]} [options.singletonDeps=[]] - Specific dependencies to enforce as singleton
 * @param {boolean} [options.strictVersion=true] - Enforce strict version matching
 * @returns {Object} Shared dependencies configuration
 */
function createSharedDependencies(dependencies, options = {}) {
  const {
    eager = false,
    singleton = true,
    strictVersion = true,
    eagerDeps = [], // Default to empty array
    singletonDeps = [],
  } = options;

  return Object.fromEntries(
    Object.keys(dependencies).map(dep => {
      const isEager = eager || eagerDeps.includes(dep);
      const isSingleton = singleton || singletonDeps.includes(dep);
      return [
        dep,
        {
          singleton: isSingleton,
          eager: isEager,
          requiredVersion: dependencies[dep],
          strictVersion,
        },
      ];
    }),
  );
}

/**
 * Common configuration chunk to be used for both
 * client-side (client.js) and server-side (server.js) bundles
 */
function createWebpackConfig(name, options = {}) {
  return merge(
    {
      // Configuration name for multi-compiler mode (used in webpack logs)
      name,

      // Server-side bundle: exclude node_modules from the bundle
      ...(name === 'server' && {
        externals: [
          nodeExternals({
            allowlist: [
              reStyle, // CSS/preprocessor files
              reImage, // Image formats
              reFont, // Font formats
              reSvg, // SVG files
              /^\.\.?\//, // Local relative imports
            ],
          }),
        ],
      }),

      // Target: node for server, web for client
      target: name === 'server' ? 'node' : 'web',

      // Set webpack mode based on environment
      mode: nodeEnv,

      // Set stats to errors-only
      stats: 'errors-only',

      // Common optimization configuration
      // Specific configs (client/server) can override or extend these
      optimization: {
        // Development: disable optimizations for accurate source maps
        // Production: Webpack enables these by default with mode: 'production'
        concatenateModules: !isDebug,
        usedExports: !isDebug,
        sideEffects: !isDebug,
        minimize: !isDebug,

        // Stable IDs for better caching
        moduleIds: isDebug ? 'named' : 'deterministic',
        chunkIds: isDebug ? 'named' : 'deterministic',

        // Disable code splitting and runtime chunk
        splitChunks: false,
        runtimeChunk: false,

        // Minification (shared for client and server)
        minimizer: !isDebug
          ? [
              new TerserPlugin({
                parallel: true,
                terserOptions: {
                  compress: {
                    // drop_console can be overridden per-target if needed
                    drop_console: name === 'client',
                    comparisons: false,
                    inline: 2,
                  },
                  mangle: { safari10: true },
                  output: {
                    comments: false,
                    ascii_only: true,
                  },
                },
              }),
            ]
          : [],
      },

      // Output configuration for server bundle
      // https://webpack.js.org/configuration/output/
      output: {
        // Public URL path for assets (must match client config)
        // This ensures server and client generate the same asset URLs
        publicPath: '/',
      },

      resolve: {
        // Allow absolute paths in imports, e.g. import Button from 'components/Button'
        // Keep in sync .eslintrc
        modules: [config.NODE_MODULES_DIR, config.APP_DIR],

        extensions: ['.js', '.jsx', '.json'],
      },

      module: {
        // Make missing exports an error instead of warning
        strictExportPresence: true,

        rules: [
          // Rules for JS / JSX
          {
            test: reScript,
            include: [config.APP_DIR, __dirname],
            use: [
              {
                loader: 'babel-loader',
                options: {
                  // Disable caching to ensure fresh builds
                  cacheDirectory: false,
                  configFile: path.resolve(__dirname, '../../.babelrc.js'),
                },
              },
            ],
          },

          // Rules for images (using webpack 5 Asset Modules)
          {
            test: reImage,
            oneOf: [
              // Inline lightweight images into CSS
              {
                issuer: reStyle,
                type: 'asset',
                parser: {
                  dataUrlCondition: {
                    maxSize: 4096, // 4kb - inline if smaller
                  },
                },
                generator: {
                  filename: getFileNamePattern(),
                },
              },

              // Or return public URL to image resource
              {
                type: 'asset/resource',
                generator: {
                  filename: getFileNamePattern(),
                },
              },
            ],
          },

          // Rules for fonts (using webpack 5 Asset Modules)
          {
            test: reFont,
            type: 'asset/resource',
            generator: {
              filename: getFileNamePattern(),
            },
          },

          // Rules for SVG files - import as React components or URLs
          {
            test: reSvg,
            oneOf: [
              // Import as React component: import { ReactComponent as Icon } from './icon.svg'
              // or default import: import Icon from './icon.svg'
              {
                issuer: reScript,
                resourceQuery: { not: [/url/i] }, // Exclude *.svg?url
                use: [
                  {
                    loader: '@svgr/webpack',
                    options: {
                      svgo: true,
                      svgoConfig: {
                        plugins: [
                          {
                            name: 'preset-default',
                            params: {
                              overrides: {
                                removeViewBox: false,
                                cleanupIds: false,
                              },
                            },
                          },
                        ],
                      },
                      titleProp: true,
                      ref: true,
                    },
                  },
                ],
              },
              // Import as URL: import iconUrl from './icon.svg?url'
              // or from CSS files
              {
                type: 'asset',
                parser: {
                  dataUrlCondition: {
                    maxSize: 8192, // 8kb - inline if smaller
                  },
                },
                generator: {
                  filename: getFileNamePattern(),
                },
              },
            ],
          },

          // Rules for HTML files (emit as separate files)
          {
            test: reHtml,
            type: 'asset/resource',
            generator: {
              filename: getFileNamePattern(),
            },
          },

          // Rules for Markdown files (parse frontmatter and convert to HTML)
          {
            test: reMarkdown,
            use: [
              {
                loader: 'frontmatter-markdown-loader',
                options: {
                  mode: ['html'],
                },
              },
            ],
          },

          // Rules for text files (return source as string)
          {
            test: reText,
            type: 'asset/source',
          },

          // Return public URL for all other assets
          {
            exclude: [
              reScript,
              reStyle,
              reImage,
              reFont,
              reSvg,
              reHtml,
              reMarkdown,
              reText,
              /\.json$/i,
            ],
            type: 'asset/resource',
            generator: {
              filename: getFileNamePattern(),
            },
          },
        ],
      },

      // Don't attempt to continue if there are any errors.
      bail: !isDebug,

      // Webpack 5 filesystem cache for faster rebuilds
      cache: false,

      // Source maps configuration
      // https://webpack.js.org/configuration/devtool/
      // Development: eval-source-map - highest quality, accurate line/column mappings
      // Production: disabled to prevent exposing application logic
      devtool: config.env(
        'WEBPACK_DEVTOOL',
        isDebug ? 'eval-source-map' : false,
      ),

      // Plugins
      plugins: [
        // Set environment variables
        new webpack.EnvironmentPlugin({ NODE_ENV: nodeEnv }),
      ],

      // Disable webpack's default node polyfills/mocks
      // This ensures __dirname and __filename behave correctly in Node.js (server)
      // and aren't unnecessarily mocked in the browser
      node: {
        __dirname: false,
        __filename: false,
        global: false,
      },
    },
    options,
    // Override output.clean to false to prevent webpack from cleaning the output directory
    // This is important because the output directory is used by multiple webpack configurations
    {
      output: {
        clean: false,
      },
    },
  );
}

module.exports = {
  isDebug,
  reScript,
  reStyle,
  reImage,
  reFont,
  reSvg,
  reHtml,
  reMarkdown,
  reText,
  reAudio,
  reVideo,
  reData,
  toPascalCase,
  createCSSRule,
  createDefinePlugin,
  createSharedDependencies,
  createWebpackConfig,
  pkg: Object.freeze(pkg),
};
