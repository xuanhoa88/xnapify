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
const { isVerbose } = require('../utils/logger');
const loadDotenv = require('./dotenv.plugin');

// =============================================================================
// CONSTANTS
// =============================================================================

// Get package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(config.CWD, 'package.json'), 'utf8'),
);

// Base webpack configuration
const nodeEnv = config.env('NODE_ENV', 'development');
const isDebug = nodeEnv !== 'production';
const isProfile = process.argv.includes('--profile');
const verbose = isVerbose();

// =============================================================================
// FILE PATTERNS
// =============================================================================

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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get file naming pattern based on environment
 * @param {string} hashType - Hash type to use
 * @returns {string} Filename pattern
 */
const getFileNamePattern = (hashType = 'contenthash') =>
  isDebug ? '[path][name][ext]' : `[${hashType}:8][ext]`;

/**
 * Create CSS loader configuration for webpack
 * Supports CSS, SCSS, SASS, and LESS with CSS Modules
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.exportOnlyLocals - True for client bundle, false for server
 * @param {any} options.extractLoader - MiniCssExtractPlugin.loader for client (optional)
 * @param {string} options.localIdentName - Custom local identifier name
 * @param {Object} options.postcssOptions - PostCSS loader options
 * @returns {Object} Webpack rule configuration
 */
const createCSSRule = ({
  exportOnlyLocals,
  extractLoader,
  localIdentName,
  postcssOptions = {},
}) => {
  // Common CSS loader options
  const cssLoaderOptions = {
    importLoaders: 1,
    sourceMap: isDebug,
    esModule: false,
    modules: {
      auto: resourcePath => resourcePath.includes(config.APP_DIR),
      exportOnlyLocals,
      localIdentName:
        localIdentName ||
        (isDebug ? '[name]-[local]-[hash:base64:5]' : '[hash:base64:5]'),
    },
  };

  // PostCSS loader options
  const postcssLoaderOptions = {
    sourceMap: isDebug,
    postcssOptions: ctx => {
      // Clear require cache to ensure fresh options for each build
      const configPath = require.resolve('../postcss.config');
      delete require.cache[configPath];
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const configFn = require(configPath);
      const result = configFn({ options: postcssOptions });
      return {
        ...result,
        parser:
          ctx && ctx.resourcePath && /\.sss$/i.test(ctx.resourcePath)
            ? 'sugarss'
            : undefined,
      };
    },
  };

  // Helper to build loader chain (executed right-to-left)
  const buildLoaders = (preprocessor = null) => {
    const loaders = [
      {
        loader: 'css-loader',
        options: {
          ...cssLoaderOptions,
          importLoaders: preprocessor ? 2 : 1,
        },
      },
      {
        loader: 'postcss-loader',
        options: postcssLoaderOptions,
      },
    ];

    if (preprocessor) {
      loaders.push(preprocessor);
    }

    if (extractLoader) {
      loaders.unshift(extractLoader);
    }

    return loaders;
  };

  return {
    test: reStyle,
    oneOf: [
      {
        test: /\.s[ac]ss$/i,
        use: buildLoaders({
          loader: 'sass-loader',
          options: {
            api: 'modern', // Use modern Sass API (fixes deprecation warning)
            sourceMap: isDebug,
          },
        }),
      },
      {
        test: /\.less$/i,
        use: buildLoaders({
          loader: 'less-loader',
          options: { sourceMap: isDebug },
        }),
      },
      {
        test: /\.styl$/i,
        use: buildLoaders({
          loader: 'stylus-loader',
          options: { sourceMap: isDebug },
        }),
      },
      {
        use: buildLoaders(),
      },
    ],
  };
};

/**
 * Create webpack.DefinePlugin instance
 * @param {Object} extraDefinitions - Additional definitions to merge
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
const createDefinePlugin = extraDefinitions =>
  new webpack.DefinePlugin({
    __DEV__: !!isDebug,
    ...extraDefinitions,
  });

/**
 * Create ProgressPlugin for verbose builds
 * @returns {webpack.ProgressPlugin|null} ProgressPlugin or null
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
 * Create environment DefinePlugin with dotenv variables
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
const createEnvDefine = () =>
  createDefinePlugin({ ...loadDotenv({ prefix: 'RSK_', verbose }) });

/**
 * Create shared dependencies configuration for Module Federation
 * @param {Object} dependencies - Package dependencies
 * @param {Object} options - Configuration options
 * @returns {Object} Shared dependencies configuration
 */
function createSharedDependencies(dependencies, options = {}) {
  const {
    eager = false,
    singleton = true,
    strictVersion = true,
    eagerDeps = [],
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
 * Minimum size (bytes) for a chunk to be split out.
 * Avoids generating tiny files that cost more in HTTP overhead than they save.
 */
const DEFAULT_MIN_CHUNK_SIZE = 20_000; // 20 kB

/**
 * Create splitChunks.cacheGroups configuration.
 * Splits vendors into granular per-package chunks for better caching.
 *
 * @param {'all' | 'async' | 'initial'} chunks - Chunk type
 * @param {number} minChunkSize - Minimum chunk size in bytes (default 20 kB)
 * @returns {Object} cacheGroups configuration
 */
function createCacheGroups(
  chunks = 'all',
  minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
) {
  return {
    // --- CSS: consolidate all extracted CSS so load order is preserved ---
    styles: {
      name: 'styles',
      type: 'css/mini-extract',
      chunks: 'all',
      enforce: true,
      priority: 100, // was +Infinity — large int is safer with Webpack internals
    },

    // --- High-priority named groups ---

    // history is a React Router peer dep; if you ever use it standalone, move it out
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|history)[\\/]/,
      name: 'vendor.react',
      chunks,
      priority: 40,
      enforce: true,
    },

    redux: {
      test: /[\\/]node_modules[\\/](react-redux|@reduxjs[\\/]toolkit|redux|redux-logger|immer|reselect)[\\/]/,
      name: 'vendor.redux',
      chunks,
      priority: 35,
      enforce: true,
    },

    core: {
      test: /[\\/]node_modules[\\/](core-js|core-js-pure|regenerator-runtime)[\\/]/,
      name: 'vendor.core',
      chunks,
      priority: 35,
      enforce: true,
    },

    // prosemirror packages are published both as flat (prosemirror-*) and scoped
    // (@prosemirror/*) — the regex covers both forms
    tiptap: {
      test: /[\\/]node_modules[\\/](@tiptap[\\/]|@prosemirror[\\/]|prosemirror-[\w-]+|turndown|marked|tippy\.js|@mixmark-io[\\/])/,
      name: 'vendor.tiptap',
      chunks,
      priority: 30,
      enforce: true,
    },

    // --- Mid-tier: group related libs together ---
    // enforce: true added so Webpack doesn't skip small packages due to minSize defaults

    forms: {
      test: /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod|cleave\.js)[\\/]/,
      name: 'vendor.forms',
      chunks,
      priority: 20,
      enforce: true,
    },

    i18n: {
      test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
      name: 'vendor.i18n',
      chunks,
      priority: 20,
      enforce: true,
    },

    polyfills: {
      test: /[\\/]node_modules[\\/](whatwg-fetch|url-polyfill|events|process)[\\/]/,
      name: 'vendor.polyfills',
      chunks,
      priority: 20,
      enforce: true,
    },

    utils: {
      test: /[\\/]node_modules[\\/](lodash|date-fns|dayjs|clsx)[\\/]/,
      name: 'vendor.utils',
      chunks,
      priority: 20,
      enforce: true,
    },

    // --- Catch-all: remaining node_modules in a single stable chunk ---
    vendors: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      chunks,
      priority: 10,
      enforce: true, // added — prevents tiny packages escaping into the main bundle
      minSize: minChunkSize,
      reuseExistingChunk: true,
    },

    // --- Shared app code used in 2+ chunks ---
    // Static name works for single-entry builds; for multi-entry consider a
    // name function to avoid chunk ID collisions across entries.
    common: {
      minChunks: 2,
      chunks,
      priority: -20,
      minSize: minChunkSize,
      reuseExistingChunk: true,
      name: 'common',
    },
  };
}

// =============================================================================
// RULE BUILDERS
// =============================================================================

/**
 * Create script rule for JS/JSX/TS files
 * @returns {Object} Webpack rule
 */
const createScriptRule = () => ({
  test: reScript,
  include: [config.APP_DIR, __dirname],
  use: [
    {
      loader: 'babel-loader',
      options: {
        cacheDirectory: false,
        configFile: path.resolve(config.CWD, 'babel.config.js'),
      },
    },
  ],
});

/**
 * Create image rule with automatic inlining
 * @returns {Object} Webpack rule
 */
const createImageRule = () => ({
  test: reImage,
  oneOf: [
    {
      issuer: reStyle,
      type: 'asset',
      parser: { dataUrlCondition: { maxSize: 4096 } },
      generator: { filename: getFileNamePattern() },
    },
    {
      type: 'asset/resource',
      generator: { filename: getFileNamePattern() },
    },
  ],
});

/**
 * Create font rule
 * @returns {Object} Webpack rule
 */
const createFontRule = () => ({
  test: reFont,
  type: 'asset/resource',
  generator: { filename: getFileNamePattern() },
});

/**
 * Create SVG rule with SVGR support
 * @returns {Object} Webpack rule
 */
const createSVGRule = () => ({
  test: reSvg,
  oneOf: [
    {
      issuer: reScript,
      resourceQuery: { not: [/url/i] },
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
    {
      type: 'asset',
      parser: { dataUrlCondition: { maxSize: 8192 } },
      generator: { filename: getFileNamePattern() },
    },
  ],
});

/**
 * Create HTML rule
 * @returns {Object} Webpack rule
 */
const createHTMLRule = () => ({
  test: reHtml,
  type: 'asset/resource',
  generator: { filename: getFileNamePattern() },
});

/**
 * Create Markdown rule
 * @returns {Object} Webpack rule
 */
const createMarkdownRule = () => ({
  test: reMarkdown,
  use: [
    {
      loader: 'frontmatter-markdown-loader',
      options: { mode: ['html'] },
    },
  ],
});

/**
 * Create text rule
 * @returns {Object} Webpack rule
 */
const createTextRule = () => ({
  test: reText,
  type: 'asset/source',
});

/**
 * Create fallback rule for other assets
 * @returns {Object} Webpack rule
 */
const createFallbackRule = () => ({
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
  generator: { filename: getFileNamePattern() },
});

// =============================================================================
// MAIN CONFIG BUILDER
// =============================================================================

/**
 * Create base webpack configuration
 * Common configuration for both client-side and server-side bundles
 *
 * @param {string} name - Configuration name ('client' or 'server')
 * @param {Object} options - Additional options to merge
 * @returns {Object} Merged webpack configuration
 */
function createWebpackConfig(name, options = {}) {
  const isServer = name === 'server';

  return merge(
    {
      name,

      // Server: exclude node_modules
      ...(isServer && {
        externals: [
          nodeExternals({
            allowlist: [reStyle, reImage, reFont, reSvg, /^\.\.\?\//],
          }),
        ],
      }),

      target: isServer ? 'node' : 'web',
      mode: nodeEnv,
      stats: 'errors-only',

      optimization: {
        concatenateModules: !isDebug,
        usedExports: !isDebug,
        sideEffects: !isDebug,
        minimize: !isDebug,
        moduleIds: isDebug ? 'named' : 'deterministic',
        chunkIds: isDebug ? 'named' : 'deterministic',

        // ✅ Enable chunk splitting (was `false` — cacheGroups were dead code)
        splitChunks: isServer
          ? false // SSR: no benefit splitting chunks server-side
          : {
              chunks: 'all',
              minSize: 20_000, // don't split tiny chunks
              minChunks: 1,
              maxAsyncRequests: 20, // allow more parallel async imports
              maxInitialRequests: 6, // cap initial page load requests
            },

        // ✅ Enable runtime chunk for client (improves long-term caching)
        // Without this, a single new module invalidates ALL chunk hashes
        runtimeChunk: isServer ? false : { name: 'runtime' },

        minimizer: !isDebug
          ? [
              new TerserPlugin({
                parallel: true,
                terserOptions: {
                  compress: {
                    drop_console: !isServer,
                    comparisons: false,
                    inline: 2,
                    passes: 2, // ✅ second pass catches more dead code
                    pure_getters: true,
                    unsafe_math: false,
                  },
                  mangle: { safari10: true },
                  output: { comments: false, ascii_only: true },
                },
              }),
              // ✅ Add CSS minification if you use CSS/MiniCssExtractPlugin
              // new CssMinimizerPlugin(),
            ]
          : [],
      },

      output: {
        publicPath: '/',
      },

      resolve: {
        modules: [config.NODE_MODULES_DIR, config.APP_DIR],
        extensions: ['.js', '.jsx', '.json'],
        alias: {
          yjs: path.resolve(config.NODE_MODULES_DIR, 'yjs'),
        },
        fallback: {
          events: require.resolve('events'),
        },
      },

      module: {
        strictExportPresence: true,
        rules: [
          createScriptRule(),
          createImageRule(),
          createFontRule(),
          createSVGRule(),
          createHTMLRule(),
          createMarkdownRule(),
          createTextRule(),
          createFallbackRule(),
        ],
      },

      bail: !isDebug,
      cache: false,
      devtool: config.env(
        'WEBPACK_DEVTOOL',
        isDebug ? (isServer ? 'source-map' : 'eval-source-map') : false,
      ),

      plugins: [new webpack.EnvironmentPlugin({ NODE_ENV: nodeEnv })],

      node: {
        __dirname: false,
        __filename: false,
        global: false,
      },
    },
    options,
    { output: { clean: false } },
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  isDebug,
  verbose,
  isProfile,
  pkg: Object.freeze(pkg),

  // File patterns
  reScript,
  reStyle,
  reImage,
  reFont,
  reSvg,
  reHtml,
  reMarkdown,
  reText,

  // Factory functions
  createCacheGroups,
  createCSSRule,
  createDefinePlugin,
  createEnvDefine,
  createProgressPlugin,
  createSharedDependencies,
  createWebpackConfig,
};
