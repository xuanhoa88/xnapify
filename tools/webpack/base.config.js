/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const { default: merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');

const config = require('../config');
const { isVerbose } = require('../utils/logger');

const loadDotenv = require('./loadDotenv');

// =============================================================================
// CONSTANTS
// =============================================================================

// Get package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(config.CWD, 'package.json'), 'utf8'),
);

// Base webpack configuration
const nodeEnv = config.env('NODE_ENV', 'development');
const isDev = nodeEnv !== 'production';
const isProfile =
  process.argv.includes('--profile') ||
  config.env('WEBPACK_PROFILE') === 'true';
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
// HOST-PROVIDED ASSETS
// =============================================================================

/**
 * Path to a minimal no-op CSS module.
 *
 * Used as a build-time replacement for CSS modules whose assets (fonts, images)
 * are already bundled by the host app's client build (build/public/).
 * Replacing them with this no-op prevents webpack from emitting duplicate
 * asset files into server and extension output directories.
 */
const NOOP_MODULE = path.resolve(__dirname, 'noop.css');

/**
 * CSS modules that ship heavy font/image assets and are already bundled by the
 * host app's client webpack compilation.
 *
 * Server and extension builds do NOT need their own copy of these assets
 * because:
 *   1. The host's client bundle (build/public/) already emits the assets and
 *      the corresponding CSS with correct publicPath references.
 *   2. Module Federation shares the JS at runtime — extensions receive the
 *      host's singleton instance, so font URLs resolve correctly.
 *   3. The server build never serves static assets to browsers.
 *
 * To add a new entry, append a regex that matches the CSS file's resolved path
 * (use [\\/] for cross-platform path separators).
 */
const HOST_PROVIDED_CSS = [
  // katex: 20 font families × 3 formats (woff2, woff, ttf) = 60 files per build
  /katex[\\/]dist[\\/]katex[\w.]*\.css$/,
];

/**
 * Create NormalModuleReplacementPlugin instances that replace host-provided CSS
 * modules with a no-op.
 *
 * Use in every webpack compilation EXCEPT the host's client build:
 *   - App server config   (build/)           → fonts not needed
 *   - Extension client     (build/extensions/) → host serves fonts at runtime
 *   - Extension server     (build/extensions/) → SSR doesn't serve static assets
 *
 * @returns {import('webpack').WebpackPluginInstance[]}
 */
function createHostProvidedCSSPlugins() {
  return HOST_PROVIDED_CSS.map(
    pattern => new webpack.NormalModuleReplacementPlugin(pattern, NOOP_MODULE),
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get file naming pattern based on environment
 * @param {string} hashType - Hash type to use
 * @returns {string} Filename pattern
 */
const getFileNamePattern = (hashType = 'contenthash') =>
  isDev ? '[path][name][ext]' : `[${hashType}:8][ext]`;

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
    sourceMap: isDev,
    esModule: false,
    modules: {
      auto: resourcePath =>
        resourcePath.includes(config.APP_DIR) ||
        resourcePath.includes(path.resolve(config.CWD, 'shared')),
      exportOnlyLocals,
      localIdentName:
        localIdentName ||
        (isDev ? '[name]-[local]-[hash:base64:5]' : '[hash:base64:5]'),
    },
  };

  // PostCSS loader options
  const postcssLoaderOptions = {
    sourceMap: isDev,
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
            sourceMap: isDev,
          },
        }),
      },
      {
        test: /\.less$/i,
        use: buildLoaders({
          loader: 'less-loader',
          options: { sourceMap: isDev },
        }),
      },
      {
        test: /\.styl$/i,
        use: buildLoaders({
          loader: 'stylus-loader',
          options: { sourceMap: isDev },
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
    __DEV__: !!isDev,
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
 * Create environment DefinePlugin (client — only XNAPIFY_PUBLIC_* vars)
 * @returns {webpack.DefinePlugin} DefinePlugin instance
 */
const createEnvDefine = () =>
  createDefinePlugin({ ...loadDotenv({ verbose }) });

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
    excludeDeps = [],
  } = options;

  return Object.fromEntries(
    Object.keys(dependencies)
      .filter(dep => !excludeDeps.includes(dep))
      .map(dep => {
        const isEager = eager || eagerDeps.includes(dep);
        const isSingleton = singleton || singletonDeps.includes(dep);
        // Use caret range so compatible patch versions from transitive
        // dependencies are accepted (no lockfile → patches may float).
        const version = dependencies[dep];
        const requiredVersion = /^\d/.test(version) ? `^${version}` : version;
        return [
          dep,
          {
            singleton: isSingleton,
            eager: isEager,
            requiredVersion,
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
      test: /[\\/]node_modules[\\/](@tiptap[\\/]|@prosemirror[\\/]|prosemirror-[\w-]+|turndown|marked|tippy\.js|@mixmark-io[\\/]|katex)/,
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
  include: [config.APP_DIR, path.resolve(config.CWD, 'shared')],
  use: [
    {
      loader: 'babel-loader',
      options: {
        comments: false,
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
        concatenateModules: !isDev,
        usedExports: !isDev,
        sideEffects: !isDev,
        minimize: !isDev,
        moduleIds: isDev ? 'named' : 'deterministic',
        chunkIds: isDev ? 'named' : 'deterministic',

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

        minimizer: !isDev
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
            ]
          : [],
      },

      output: {
        publicPath: '/',
        libraryTarget: isServer ? 'commonjs2' : 'umd',
      },

      resolve: {
        modules: ['node_modules', config.APP_DIR],
        extensions: ['.js', '.jsx', '.json'],
        alias: {
          '@shared': path.resolve(config.CWD, 'shared'),
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

      // Stop compilation on first error
      bail: !isDev,

      // Disable filesystem caching
      cache: false,

      // Enable source maps for debugging
      devtool: config.env(
        'WEBPACK_DEVTOOL',
        isDev ? (isServer ? 'source-map' : 'eval-source-map') : false,
      ),

      plugins: [new webpack.EnvironmentPlugin({ NODE_ENV: nodeEnv })],

      node: {
        __dirname: false,
        __filename: false,
        global: false,
      },
    },
    options,
    {
      output: {
        clean: false,
      },
    },
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  isDev,
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
  createHostProvidedCSSPlugins,
  createProgressPlugin,
  createSharedDependencies,
  createWebpackConfig,
};
