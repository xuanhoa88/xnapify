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

export const isDebug = process.env.NODE_ENV !== 'production';

const verbose = isVerbose(); // Cache verbose check

export const isAnalyze =
  process.argv.includes('--analyze') ||
  process.argv.includes('--analyse') ||
  config.bundleAnalyze;

export const isProfile = process.argv.includes('--profile') || BUNDLE_PROFILE;
// JavaScript/TypeScript files (including ES modules and CommonJS)
export const reScript = /\.[jt]sx?$/i; // .js, .jsx, .ts, .tsx
export const reScriptLegacy = /\.[cm][jt]s$/i; // .cjs, .mjs, .cts, .mts

// Stylesheet files (CSS, SCSS, SASS, LESS, Stylus, SugarSS)
export const reStyle = /\.(css|s[ac]ss|less|styl|sss)$/i;

// Image files (with optional query string for cache busting)
export const reImage = /\.(?:ico|gif|png|jpe?g|webp|bmp|avif)(?:\?.*)?$/i;

// Font files (with optional query string for cache busting)
export const reFont = /\.(?:woff2?|eot|ttf|otf)(?:\?.*)?$/i;

// SVG files (handled separately for React component conversion)
export const reSvg = /\.svg(?:\?.*)?$/i;

// Markup and document files
export const reHtml = /\.html?$/i; // Supports .htm too
export const reMarkdown = /\.(?:md|markdown)$/i;
export const reText = /\.txt$/i;

// Media files
export const reAudio = /\.(?:mp3|wav|ogg|m4a|aac|flac)$/i;
export const reVideo = /\.(?:mp4|webm|ogv|mov|avi|mkv)$/i;

// Data files
export const reData = /\.(?:json|xml|csv|ya?ml)$/i;

/** Get file naming pattern based on environment */
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
export const createCSSRule = ({ isClient, extractLoader }) => {
  // Common CSS loader options
  const cssLoaderOptions = {
    importLoaders: 1, // Will be dynamically adjusted per preprocessor
    sourceMap: isClient && isDebug,
    esModule: false,
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

    // For client: add extract/style-loader at the beginning (executes last)
    if (isClient && extractLoader) {
      return [extractLoader, ...loaders];
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
          options: {
            sourceMap: isClient && isDebug,
          },
        }),
      },

      // LESS
      {
        test: /\.less$/i,
        use: buildLoaders({
          loader: 'less-loader',
          options: {
            sourceMap: isClient && isDebug,
          },
        }),
      },

      // Stylus
      {
        test: /\.styl$/i,
        use: buildLoaders({
          loader: 'stylus-loader',
          options: {
            sourceMap: isClient && isDebug,
          },
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
 * @param {Object} options - Configuration options
 * @param {boolean} options.isClient - True for client bundle, false for server
 * @param {Object} options.extraDefinitions - Additional definitions to merge (optional)
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
export const createDefinePluginConfig = ({ isClient, ...extraDefinitions }) =>
  new webpack.DefinePlugin({
    // Browser flag - used to conditionally execute code based on environment
    'process.env.BROWSER': !!isClient,
    // Development flag - used for dev-only code (logging, debugging, etc.)
    __DEV__: !!isDebug,
    // Merge any additional definitions (e.g., RSK_ env vars for server)
    ...extraDefinitions,
  });

/**
 * Common configuration chunk to be used for both
 * client-side (client.js) and server-side (server.js) bundles
 */
export function createBaseConfig() {
  return {
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

    // Performance hints
    performance:
      BUNDLE_PERFORMANCE_HINTS && !isDebug
        ? {
            maxAssetSize: config.bundleMaxAssetSize,
            maxEntrypointSize: BUNDLE_MAX_ENTRYPOINT_SIZE,
            hints: 'warning',
            assetFilter: assetFilename => /\.(js|css)$/i.test(assetFilename),
          }
        : false,
  };
}
