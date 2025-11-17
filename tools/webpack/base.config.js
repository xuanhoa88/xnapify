/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';
import webpack from 'webpack';
import config from '../config';
import { isVerbose } from '../lib/logger';

// Base webpack configuration
const BUNDLE_PROFILE = config.env('BUNDLE_PROFILE') === 'true';
const BUNDLE_SOURCE_MAPS = config.env('BUNDLE_SOURCE_MAPS') !== 'false';
const BUNDLE_MAX_ENTRYPOINT_SIZE =
  parseInt(config.env('BUNDLE_MAX_ENTRYPOINT_SIZE'), 10) || 250000; // 250KB
const BUNDLE_PERFORMANCE_HINTS =
  config.env('BUNDLE_PERFORMANCE_HINTS') !== 'false';

/** Get file naming pattern based on environment */
const getFileNamePattern = (isDebug, hashType = 'hash') =>
  isDebug ? '[path][name][ext]' : `[${hashType}:8][ext]`;

/**
 * Create CSS loader configuration for webpack
 * Supports CSS, SCSS, SASS, and LESS with CSS Modules
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.isClient - True for client bundle, false for server
 * @param {boolean} options.isDebug - Development mode flag
 * @param {any} options.extractLoader - MiniCssExtractPlugin.loader for client (optional)
 * @returns {Object} Webpack rule configuration
 */
export const createCSSRule = ({ isClient, isDebug, extractLoader }) => {
  // Common CSS loader options
  const cssLoaderOptions = {
    // Number of loaders applied before css-loader (for @import resolution)
    // Current: 1 (postcss-loader only)
    // With SCSS/SASS: 2 (postcss-loader + sass-loader)
    // With LESS: 2 (postcss-loader + less-loader)
    importLoaders: 1,
    sourceMap: isClient && isDebug, // Source maps only for client in dev mode
    esModule: false, // Required for compatibility
    modules: {
      // Enable CSS Modules only for files in src/ directory
      auto: resourcePath => resourcePath.includes(config.APP_DIR),
      // Server: only export class names, Client: full CSS
      exportOnlyLocals: !isClient,
      localIdentName: isDebug
        ? '[name]-[local]-[hash:base64:5]'
        : '[hash:base64:5]',
    },
  };

  // PostCSS loader options
  const postcssLoaderOptions = {
    sourceMap: isClient && isDebug,
    postcssOptions: {
      config: path.resolve(__dirname, '...', 'postcss.config.js'),
      // SugarSS parser (for .sss files)
      // Automatically uses sugarss parser when file extension is .sss
      // Install: npm install -D sugarss
      parser: file => {
        if (file && file.endsWith('.sss')) {
          return require('sugarss');
        }
        return undefined; // Use default parser for other files
      },
    },
  };

  // SCSS/SASS loader options (uncomment when sass-loader is installed)
  const sassLoaderOptions = {
    sourceMap: isClient && isDebug,
  };

  // LESS loader options (uncomment when less-loader is installed)
  const lessLoaderOptions = {
    sourceMap: isClient && isDebug,
  };

  // Stylus loader options (uncomment when stylus-loader is installed)
  const stylusLoaderOptions = {
    sourceMap: isClient && isDebug,
  };

  return {
    test: reStyle,
    rules: [
      // First rule: Extract CSS (client) or just get class names (server)
      {
        issuer: { not: [reStyle] },
        ...(isClient
          ? { use: extractLoader } // Client: extract CSS to files
          : { loader: 'css-loader', options: cssLoaderOptions }), // Server: class names only
      },
      // Process CSS with css-loader (only for client, server uses above)
      ...(isClient
        ? [
            {
              loader: 'css-loader',
              options: cssLoaderOptions,
            },
          ]
        : []),
      // PostCSS loader (autoprefixer, etc.)
      {
        loader: 'postcss-loader',
        options: postcssLoaderOptions,
      },

      // Preprocessor loaders (conditional on file extension)
      // Install the packages you need:
      // - SCSS/SASS: npm install -D sass sass-loader
      // - LESS: npm install -D less less-loader
      // - Stylus: npm install -D stylus stylus-loader
      // - SugarSS: npm install -D sugarss (handled by PostCSS parser above, no loader needed)
      // Note: Update importLoaders count above when enabling preprocessors

      // SCSS/SASS loader
      {
        test: /\.s[ac]ss$/i,
        loader: 'sass-loader',
        options: sassLoaderOptions,
      },

      // LESS loader
      {
        test: /\.less$/i,
        loader: 'less-loader',
        options: lessLoaderOptions,
      },

      // Stylus loader
      {
        test: /\.styl$/i,
        loader: 'stylus-loader',
        options: stylusLoaderOptions,
      },
    ],
  };
};

export const isDebug = process.env.NODE_ENV !== 'production';

const verbose = isVerbose(); // Cache verbose check

export const isAnalyze =
  process.argv.includes('--analyze') ||
  process.argv.includes('--analyse') ||
  config.bundleAnalyze;

export const isProfile = process.argv.includes('--profile') || BUNDLE_PROFILE;

// JavaScript files (including ES modules and CommonJS)
export const reScript = /\.(js|jsx|[cm]js)$/i;

// Stylesheet files (CSS, SCSS, SASS, LESS, Stylus, SugarSS)
export const reStyle = /\.(css|s[ac]ss|less|styl|sss)$/i;

// Image files (with optional version query string)
export const reImage = /\.(?:ico|gif|png|jpg|jpeg|webp)(\?v=\d+\.\d+\.\d+)?$/i;

// Font files (with optional version query string)
export const reFont = /\.(woff2?|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/i;

// SVG files (handled separately for React component conversion)
export const reSvg = /\.svg$/i;

// Markup and document files
export const reHtml = /\.html$/i;
export const reMarkdown = /\.(md|markdown)$/i;
export const reText = /\.txt$/i;

/**
 * Create webpack.DefinePlugin instance
 * Defines global constants that can be configured at compile time
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.isBrowser - True for client bundle, false for server
 * @param {boolean} options.isDebug - Development mode flag
 * @param {Object} options.extraDefinitions - Additional definitions to merge (optional)
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
export const createDefinePluginConfig = ({
  isBrowser,
  isDebug,
  ...extraDefinitions
}) =>
  new webpack.DefinePlugin({
    // Browser flag - used to conditionally execute code based on environment
    'process.env.BROWSER': !!isBrowser,
    // Development flag - used for dev-only code (logging, debugging, etc.)
    __DEV__: !!isDebug,
    // Merge any additional definitions (e.g., RSK_ env vars for server)
    ...extraDefinitions,
  });

/**
 * Common configuration chunk to be used for both
 * client-side (client.js) and server-side (server.js) bundles
 */
export default {
  mode: process.env.NODE_ENV || 'development',

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

    // Webpack 5 polyfills configuration
    // https://webpack.js.org/configuration/resolve/#resolvefallback
    fallback: {
      fs: false,
      net: false,
      tls: false,
    },

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

              // Use .babelrc.js for all Babel configuration
              // This provides:
              // - Modern JavaScript features (optional chaining, nullish coalescing, etc.)
              // - Production optimizations (constant elements, inline elements, remove prop-types)
              // - Automatic polyfills via useBuiltIns: 'usage' with core-js 3
              // - React Fast Refresh in development
              // - All necessary plugins for modern React development
              // Note: .babelrc.js uses api.caller() to detect webpack context automatically
              targets: 'defaults',
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
              filename: getFileNamePattern(isDebug),
            },
          },

          // Or return public URL to image resource
          {
            type: 'asset/resource',
            generator: {
              filename: getFileNamePattern(isDebug),
            },
          },
        ],
      },

      // Rules for fonts (using webpack 5 Asset Modules)
      {
        test: reFont,
        type: 'asset/resource',
        generator: {
          filename: getFileNamePattern(isDebug),
        },
      },

      // Rules for SVG files - import as React components or URLs
      {
        test: reSvg,
        oneOf: [
          // Import as React component: import { ReactComponent as Icon } from './icon.svg'
          // or default import: import Icon from './icon.svg'
          {
            issuer: /\.[jt]sx?$/i,
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
              filename: getFileNamePattern(isDebug),
            },
          },
        ],
      },

      // Rules for HTML files (emit as separate files)
      {
        test: reHtml,
        type: 'asset/resource',
        generator: {
          filename: getFileNamePattern(isDebug),
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
          filename: getFileNamePattern(isDebug),
        },
      },
    ],
  },

  // Common optimization configuration
  // Specific configs (client/server) can override or extend these
  optimization: {
    // Scope hoisting - concatenate modules for smaller bundles (production only)
    concatenateModules: !isDebug,

    // Tree shaking - remove unused exports
    usedExports: true,
    sideEffects: true,

    // Code splitting - split vendors and common code into separate chunks
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendors: all node_modules
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 20,
          reuseExistingChunk: true,
        },
        // Common: shared code (used in 2+ places)
        common: {
          minChunks: 2,
          name: 'common',
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },

    // Stable module/chunk IDs for better caching
    moduleIds: isDebug ? 'named' : 'deterministic',
    chunkIds: isDebug ? 'named' : 'deterministic',
  },

  // Don't attempt to continue if there are any errors.
  bail: !isDebug,

  // Webpack 5 filesystem cache for faster rebuilds
  cache: false,

  // Stats output configuration
  stats: {
    preset: verbose ? 'normal' : 'errors-warnings',
    colors: true,
    // Show timing information
    timings: true,
    // Show built modules
    modules: verbose,
    // Show chunk information
    chunks: isDebug,
    // Show asset information
    assets: verbose,
    // Show reasons for including modules
    reasons: isDebug,
    // Show performance hints
    performance: !isDebug,
  },

  // Webpack 5 infrastructure logging
  infrastructureLogging: {
    level: verbose ? 'info' : 'warn',
  },

  // Watch mode configuration
  watchOptions: {
    ignored: ['**/node_modules', '**/.git'],
  },

  // Performance hints
  performance:
    BUNDLE_PERFORMANCE_HINTS && !isDebug
      ? {
          maxAssetSize: config.bundleMaxAssetSize,
          maxEntrypointSize: BUNDLE_MAX_ENTRYPOINT_SIZE,
          hints: 'warning',
          assetFilter: assetFilename => /\.(js|css)$/.test(assetFilename),
        }
      : false,

  // Choose a developer tool to enhance debugging
  // https://webpack.js.org/configuration/devtool/
  devtool: BUNDLE_SOURCE_MAPS
    ? process.env.WEBPACK_DEVTOOL ||
      (isDebug ? 'eval-cheap-module-source-map' : 'source-map')
    : false,
};
