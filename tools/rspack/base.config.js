/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import { rspack } from '@rspack/core';
import browserslist from 'browserslist';
import merge from 'rspack-merge';
import nodeExternals from 'webpack-node-externals';

import config from '../config.js';
import globalPostcssConfigFn from '../factories/postcss.factory.js';
import { postcssConfigs } from '../factories/registry.factory.js';
import { listBundledExtensionIds } from '../utils/extension.js';
import { isVerbose } from '../utils/logger.js';

import loadDotenv from './loadDotenv.js';

const require = createRequire(import.meta.url);
const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

// =============================================================================
// CONSTANTS
// =============================================================================

// Get package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(config.CWD, 'package.json'), 'utf8'),
);

// Base rspack configuration
const nodeEnv = config.env('NODE_ENV', 'development');
const isDev = nodeEnv !== 'production';
const isProfile =
  process.argv.includes('--profile') || config.env('RSPACK_PROFILE') === 'true';
const verbose = isVerbose();
// In-memory compilation cache: always on in dev, never in prod.
const useMemoryCache = isDev;

// Rspack's *persistent* (filesystem) cache is OPT-IN and defaults to OFF.
//
// It belongs at top-level `cache` — `experiments.cache` is not a key
// @rspack/core 2.0.1 implements, and unknown `experiments` keys pass
// validation untouched, so configuring it there silently does nothing.
// That is how it sat here dead: the documented dev cold-start win never
// happened and `.cache/rspack` was never created.
//
// Wiring it up correctly then exposed why it cannot be on by default:
// rspack_storage PANICS (SIGABRT, killing the dev task) when two
// transactions touch one storage directory —
//   crates/rspack_storage/src/filesystem/db/transaction/mod.rs:53
//   "Transaction already in progress by process <pid> in directory ..."
// `npm run dev` drives 14+ concurrent compilers (app client, app server and
// 12 extensions, each with client/server/api/nodes bundles) and rebuilds
// them on watch, and contention is reached even with a directory used by a
// single compiler. Until that is fixed upstream, correctness beats a warm
// cache: set RSPACK_PERSISTENT_CACHE=true to experiment with it.
const usePersistentCache =
  isDev && config.env('RSPACK_PERSISTENT_CACHE') === 'true';

// Resolve .browserslistrc query strings once per build session.
// LightningCssMinimizerRspackPlugin expects browserslist QUERIES (e.g. '> 0.5%'),
// NOT resolved browser names (e.g. 'chrome 147'). Using browserslist.loadConfig()
// reads the raw queries from .browserslistrc for the current NODE_ENV.
const targetBrowsers = Object.freeze(
  browserslist.loadConfig({ path: config.CWD, env: nodeEnv }) || ['defaults'],
);

// =============================================================================
// FILE PATTERNS
// =============================================================================

// JavaScript/TypeScript files (including ES modules and CommonJS)
const reScript = /\.[cm]?[jt]sx?$/i;

// Styles
const reStyle = /\.(?:css|s[ac]ss)(?:\?.*)?$/i;

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

/**
 * Create a pre-configured nodeExternals instance.
 * Centralises the shared allowlist so every server / worker / extension
 * build uses the same set of bundled asset patterns.
 *
 * @param {Object} [opts] - Extra options forwarded to webpack-node-externals
 * @param {string[]} [opts.additionalModuleDirs] - Extra node_modules dirs
 * @param {Array} [opts.allowlist] - Extra patterns to bundle (merged with defaults)
 * @returns {Function} nodeExternals instance
 */
function createNodeExternals(opts = {}) {
  const { allowlist: extra = [], ...rest } = opts;
  return nodeExternals({
    allowlist: [
      /^@shared/,
      reStyle,
      reImage,
      reFont,
      reSvg,
      /^\.\.\?\//,
      ...extra,
    ],
    ...rest,
  });
}

// =============================================================================
// HOST-PROVIDED ASSETS
// =============================================================================

/**
 * Path to a minimal no-op CSS module.
 *
 * Used as a build-time replacement for CSS modules whose assets (fonts, images)
 * are already bundled by the host app's client build (build/public/).
 * Replacing them with this no-op prevents rspack from emitting duplicate
 * asset files into server and extension output directories.
 */
const NOOP_MODULE = path.resolve(currentDir, 'noop.css');

/**
 * CSS modules that ship heavy font/image assets and are already bundled by the
 * host app's client rspack compilation.
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
 * Use in every rspack compilation EXCEPT the host's client build:
 *   - App server config   (build/)           → fonts not needed
 *   - Extension client     (build/extensions/) → host serves fonts at runtime
 *   - Extension server     (build/extensions/) → SSR doesn't serve static assets
 *
 * @returns {import('@rspack/core').RspackPluginInstance[]}
 */
function createHostProvidedCSSPlugins() {
  return HOST_PROVIDED_CSS.map(
    pattern => new rspack.NormalModuleReplacementPlugin(pattern, NOOP_MODULE),
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
 * Create CSS loader configuration for rspack
 * Supports CSS, SCSS, and SASS with CSS Modules
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.exportOnlyLocals - True for client bundle, false for server
 * @param {any} options.extractLoader - MiniCssExtractPlugin.loader for client (optional)
 * @param {string} options.localIdentName - Custom local identifier name
 * @param {Object} options.postcssOptions - PostCSS loader options
 * @returns {Object} Rspack rule configuration
 */
const createCSSRule = ({
  exportOnlyLocals,
  extractLoader,
  localIdentName,
  postcssOptions = {},
  include,
  exclude,
}) => {
  // Common CSS loader options
  const cssLoaderOptions = {
    importLoaders: 1,
    sourceMap: isDev,
    esModule: false,
    modules: {
      auto: resourcePath => {
        if (/\.global\.css$/.test(resourcePath)) return false;
        // Blacklist approach: Treat all internal CSS files as CSS Modules
        // automatically (src, shared, hub/extensions, etc) while explicitly
        // excluding third-party stylesheets.
        if (resourcePath.includes(`node_modules`)) return false;
        return true;
      },
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
      // Get global postcss config
      const globalConfig = globalPostcssConfigFn({
        options: postcssOptions,
        cwd: config.CWD,
      });

      // Look up local postcss config from the registry
      let localPlugins = [];
      if (ctx && ctx.resourcePath) {
        // use imported postcssConfigs
        // Sort by path length descending so the most specific
        // (deepest) module directory wins when paths are nested.
        const matchedConfig = (
          Array.isArray(postcssConfigs) ? postcssConfigs : []
        )
          .sort((a, b) => b.moduleDir.length - a.moduleDir.length)
          .find(cfg => ctx.resourcePath.startsWith(cfg.moduleDir));
        if (matchedConfig) {
          try {
            delete require.cache[require.resolve(matchedConfig.path)];
          } catch {
            // Config file may not be cached yet — ignore
          }
          const localConfigRaw = require(matchedConfig.path);
          const localConfigFn = localConfigRaw.default || localConfigRaw;
          const localCfg =
            typeof localConfigFn === 'function'
              ? localConfigFn({ options: postcssOptions })
              : localConfigFn;
          if (localCfg && localCfg.plugins) {
            localPlugins = Array.isArray(localCfg.plugins)
              ? localCfg.plugins
              : [localCfg.plugins];
          }
        }
      }

      // Merge global and local plugins
      const mergedPlugins = [...globalConfig.plugins, ...localPlugins];

      return {
        ...globalConfig,
        plugins: mergedPlugins,
      };
    },
  };

  // Helper to build loader chain (executed right-to-left)
  const buildLoaders = (preprocessor = null, skipPostcss = false) => {
    const loaders = [
      {
        loader: 'css-loader',
        options: {
          ...cssLoaderOptions,
          // Adjust importLoaders based on whether we have postcss and/or a preprocessor
          importLoaders: skipPostcss
            ? preprocessor
              ? 1
              : 0
            : preprocessor
              ? 2
              : 1,
        },
      },
    ];

    if (!skipPostcss) {
      loaders.push({
        loader: 'postcss-loader',
        options: postcssLoaderOptions,
      });
    }

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
    type: 'javascript/auto',
    ...(include && { include }),
    ...(exclude && { exclude }),
    oneOf: [
      {
        test: /\.s[ac]ss$/i,
        use: buildLoaders(
          {
            loader: 'sass-loader',
            options: {
              api: 'modern', // Use modern Sass API (fixes deprecation warning)
              sourceMap: isDev,
            },
          },
          false,
        ), // SCSS usually needs PostCSS (autoprefixer) after compilation
      },
      {
        // PERFORMANCE OPTIMIZATION:
        // Skip PostCSS entirely for node_modules. Third-party CSS (like Radix UI)
        // is already compiled, prefixed, and doesn't contain Tailwind utilities.
        // Skipping the PostCSS AST parsing for huge library CSS files drastically
        // speeds up both `npm run dev` and `npm run build`.
        test: /[\\/]node_modules[\\/]/,
        use: buildLoaders(null, true),
      },
      {
        // Standard application CSS (gets PostCSS + Tailwind)
        use: buildLoaders(null, false),
      },
    ],
  };
};

/**
 * Create rspack.DefinePlugin instance
 * @param {Object} extraDefinitions - Additional definitions to merge
 * @returns {rspack.DefinePlugin} DefinePlugin instance
 */
const createDefinePlugin = extraDefinitions =>
  new rspack.DefinePlugin({
    __DEV__: !!isDev,
    // Host version used by the extension compatibility contract
    __XNAPIFY_VERSION__: JSON.stringify(pkg.version),
    // Extensions compiled into this build. They are the only ones the
    // capability contract trusts with the privileged tier (`db`, `models`,
    // …) on their manifest alone — a hub install writes its own manifest,
    // and by then there is no build left to vouch for it.
    __XNAPIFY_BUNDLED_EXTENSIONS__: JSON.stringify(listBundledExtensionIds()),
    ...extraDefinitions,
  });

/**
 * Create ProgressPlugin for verbose builds
 * @returns {rspack.ProgressPlugin|null} ProgressPlugin or null
 */
const createProgressPlugin = () =>
  verbose
    ? new rspack.ProgressPlugin({
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
 * @returns {rspack.DefinePlugin} DefinePlugin instance
 */
const createEnvDefine = () =>
  createDefinePlugin({ ...loadDotenv({ verbose }) });

/**
 * Create shared dependencies configuration for Module Federation
 * @param {Object} dependencies - Package dependencies
 * @param {Object} options - Configuration options
 * @returns {Object} Shared dependencies configuration
 */
/**
 * Packages that must resolve to exactly one copy across host and remotes.
 * A remote built against another major of these silently binding to the
 * host copy is the classic "hooks can only be called inside a component"
 * failure, so version mismatches fail loudly at load time instead.
 */
const MF_STRICT_SINGLETONS = Object.freeze([
  'react',
  'react-dom',
  'react-redux',
  '@reduxjs/toolkit',
  'react-i18next',
  'i18next',
  'history',
]);

/**
 * Packages the host entry (src/client.js and everything it imports
 * synchronously) needs before the first async boundary. Only these are
 * shared eagerly; everything else is consumed on demand from the chunk that
 * first imports it, so the editor, form and table libraries no longer sit in
 * the initial download of every page.
 */
const MF_HOST_EAGER_DEPS = Object.freeze([
  'react',
  'react-dom',
  'react-redux',
  'redux',
  '@reduxjs/toolkit',
  'use-sync-external-store',
  'react-i18next',
  'i18next',
  'history',
  'prop-types',
  'clsx',
  'events',
  'core-js',
  '@radix-ui/themes',
]);

function createSharedDependencies(dependencies, options = {}) {
  const {
    eager = false,
    singleton = true,
    strictVersion = true,
    eagerDeps = [],
    singletonDeps = [],
    excludeDeps = [],
    strictDeps = MF_STRICT_SINGLETONS,
    // When false the consumer ships no fallback copy: it must obtain the
    // package from the host's share scope. Remotes use this because the host
    // declares every shared package, and a singleton share always resolves to
    // the host copy anyway — the fallback was dead weight that still loaded.
    importFallback = true,
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
        const rawVersion = version.replace(/^[\^~]/, '');
        const requiredVersion = /^\d/.test(version) ? `^${version}` : version;
        return [
          dep,
          {
            singleton: isSingleton,
            eager: isEager,
            requiredVersion,
            strictVersion: strictVersion || strictDeps.includes(dep),
            version: rawVersion,
            ...(importFallback ? {} : { import: false }),
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
/**
 * Locales the application ships, read from the shared dictionary directory.
 * @returns {string[]}
 */
function readAvailableLocales() {
  try {
    return fs
      .readdirSync(path.join(config.CWD, 'shared', 'i18n', 'translations'))
      .filter(name => name.endsWith('.json'))
      .map(name => name.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/**
 * One chunk per locale for the per-module dictionaries.
 *
 * Module translations are loaded through lazy contexts so the browser only
 * fetches the language it is showing. Without grouping that would be one
 * request per module per locale; this collapses them into a single file the
 * server can name in the page. Route-level dictionaries are deliberately
 * excluded: they live under `views/` and belong in their route's own chunk.
 *
 * @param {string[]} locales - Locale codes
 * @returns {Object} splitChunks cache groups
 */
function createLocaleCacheGroups(locales) {
  return Object.fromEntries(
    locales.map(locale => [
      `locale_${locale.replace(/[^a-zA-Z0-9]/g, '_')}`,
      {
        test: new RegExp(
          `[\\\\/]apps[\\\\/][^\\\\/]+[\\\\/]translations[\\\\/]${locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.json$`,
        ),
        name: `locale.${locale}`,
        chunks: 'async',
        priority: 60,
        enforce: true,
      },
    ]),
  );
}

function createCacheGroups(
  chunks = 'all',
  minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
) {
  return {
    ...createLocaleCacheGroups(readAvailableLocales()),

    // --- High-priority named groups ---

    // Bundle all CSS into a single chunk to avoid FOUC and guarantee CSS loading order.
    // This is especially critical for Tailwind CSS + Radix UI where utility classes
    // must be able to override component styles consistently.
    styles: {
      name: 'styles',
      type: 'css/mini-extract',
      chunks: 'all',
      enforce: true,
      priority: 50,
    },

    // Radix UI primitives + their positioning/floating deps
    radix: {
      test: /[\\/]node_modules[\\/](@radix-ui[\\/]|@floating-ui[\\/]|@popperjs[\\/])/,
      name: 'vendor.radix',
      chunks,
      priority: 45,
      enforce: true,
    },

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

    // NOTE: there is deliberately no enforced group for the TipTap/ProseMirror
    // family or for react-hook-form + @hookform/resolvers. Those packages are
    // shared non-eagerly through Module Federation and depend on each other;
    // forcing them into one named chunk makes that chunk wait on a shared
    // module whose fallback lives inside the very chunk being loaded, which
    // never resolves. Rspack's default split keeps each shared fallback in its
    // own async chunk, where no such cycle can form.

    // Markdown conversion is consumed on its own (extensions render docs with
    // `marked`); keeping it apart from the editor group means a page that
    // renders markdown no longer downloads ProseMirror as well.
    //
    // `chunks: 'initial'` is load-bearing, NOT the shared `chunks` argument:
    // `marked` and `turndown` are non-eager Module Federation shares, so an
    // async fixed-name chunk holding them is exactly the deadlock described
    // above — the chunk waits on a shared module whose fallback it contains.
    // Today no host view imports markdown, so the group never fires and the
    // bug is invisible; restricting it to initial chunks keeps it that way,
    // and the async case falls back to rspack's per-share default split.
    markdown: {
      test: /[\\/]node_modules[\\/](marked|turndown|@mixmark-io[\\/])/,
      name: 'vendor.markdown',
      chunks: 'initial',
      priority: 31,
      enforce: true,
    },

    // --- Mid-tier: group related libs together ---
    // enforce: true added so rspack doesn't skip small packages due to minSize defaults

    i18n: {
      test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
      name: 'vendor.i18n',
      chunks,
      priority: 20,
      enforce: true,
    },

    polyfills: {
      test: /[\\/]node_modules[\\/](events|process)[\\/]/,
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

    // --- Catch-all: remaining node_modules reachable from the entry ---
    // Restricted to initial chunks on purpose: a fixed-name group that also
    // swept async chunks merged every lazily imported dependency into the
    // one vendors file that loads on every page. Dependencies reached only
    // through async chunks fall to rspack's default per-chunk vendor split.
    vendors: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      chunks: chunks === 'all' ? 'initial' : chunks,
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
      // Initial only — see the splitChunks note in createRspackConfig
      chunks: 'initial',
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
 * @param {boolean} isServer - True for server bundle, false for client bundle
 * @returns {Object} Rspack rule
 */
const createScriptRule = (isServer = false) => ({
  test: reScript,
  include: [config.APP_DIR, path.resolve(config.CWD, 'shared')],
  exclude: [/node_modules/],
  type: 'javascript/auto',
  resolve: { fullySpecified: false },
  parser: {
    javascript: {
      requireContext: true,
      commonjsMagicComments: true,
    },
  },
  use: [
    {
      loader: 'builtin:swc-loader',
      options: {
        jsc: {
          parser: {
            syntax: 'ecmascript',
            jsx: true,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
              development: isDev,
              // React Fast Refresh is enabled per-compiler in
              // configurerspackForDev (dev.js) — default off here
              // so the server bundle is not affected.
              refresh: false,
            },
          },
          // Disable loose mode to ensure iterables (Set, Map, etc) spread correctly
          loose: false,
        },
        module: { type: 'es6' },
        // Production: inject core-js polyfills for browser compatibility
        // (polyfill injection based on browser targets + core-js usage).
        // Development and Server: skip polyfills. Server doesn't need browser
        // core-js polyfills like DOMException, and dev targets modern browsers.
        ...(isDev || isServer
          ? {}
          : {
              env: {
                targets: 'defaults',
                mode: 'usage',
                coreJs: '3.46',
              },
            }),
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
          loader: '@svgr-rs/svgrs-plugin/webpack',
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
 * Create base rspack configuration
 * Common configuration for both client-side and server-side bundles
 *
 * @param {string} name - Configuration name ('client' or 'server')
 * @param {Object} options - Additional options to merge
 * @returns {Object} Merged rspack configuration
 */
function createRspackConfig(name, options = {}) {
  const isServer = name === 'server';

  // Extract additionalModuleDirs before forwarding to merge
  const { additionalModuleDirs, cacheKey, ...mergeOptions } = options;

  // `name` is a ROLE ('server' | 'client'), not an identity: the app and every
  // extension bundle reuse both values, so it can never key a cache directory.
  // Persistent cache is therefore opt-in via an explicit, globally unique
  // `cacheKey`. Two compilers sharing one storage directory abort the process
  // with `Transaction already in progress` from rspack_storage.
  const cacheDir = cacheKey
    ? String(cacheKey).replace(/[^a-zA-Z0-9._-]+/g, '-')
    : null;
  const usePersistentCacheHere = usePersistentCache && Boolean(cacheDir);

  return merge(
    {
      name,

      // Server: exclude node_modules
      ...(isServer && {
        externals: [
          createNodeExternals(
            additionalModuleDirs ? { additionalModuleDirs } : {},
          ),
          'sqlite3',
          'mysql2',
          'pg',
          'pg-hstore',
          'mariadb',
          'tedious',
        ],
      }),

      target: isServer ? 'node' : 'web',
      mode: nodeEnv,
      stats: 'errors-only',

      watchOptions: {
        ignored: getHmrWatchIgnored(),
        aggregateTimeout: 300,
      },

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
              // Only initial chunks are split generically. Async chunks keep
              // rspack's natural per-import-block layout so a Module
              // Federation fallback module is never merged into a chunk that
              // also consumes it (the load would wait on itself and never
              // resolve). Named cache groups below opt into 'all' explicitly
              // for package families that do not consume each other.
              chunks: 'initial',
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
              new rspack.SwcJsMinimizerRspackPlugin({
                compress: { drop_console: !isServer },
              }),
              new rspack.LightningCssMinimizerRspackPlugin({
                minimizerOptions: {
                  targets: targetBrowsers,
                },
              }),
            ]
          : [],
      },

      output: {
        publicPath: '/',
        ...(isServer && {
          library: { type: 'commonjs2' },
        }),
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
          createScriptRule(isServer),
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

      // Compilation cache. Persistent (filesystem) only when a compiler
      // declares a unique `cacheKey` AND RSPACK_PERSISTENT_CACHE=true;
      // otherwise in-memory. Production always cold, so an artifact never
      // depends on a stale cache. See the flag definitions at the top of
      // this file for why persistent is opt-in.
      cache: usePersistentCacheHere
        ? {
            type: 'persistent',
            version: `${nodeEnv}:${pkg.version}`,
            storage: {
              type: 'filesystem',
              directory: path.join(config.CWD, '.cache', 'rspack', cacheDir),
            },
            // Every file that shapes the compilation but is not itself a
            // module in the graph. Miss one and its edits are invisible to
            // the cache — the PostCSS plugin chain in particular, since a
            // stylesheet's output depends on it without importing it.
            buildDependencies: [
              currentFilename,
              path.join(currentDir, 'app.config.js'),
              path.join(currentDir, 'extension.config.js'),
              path.resolve(currentDir, '../factories/postcss.factory.js'),
              path.resolve(currentDir, '../postcss/RadixBreakpointTrim.js'),
              path.join(config.CWD, 'package.json'),
            ],
          }
        : // In-memory cache only. Shared safely by any number of concurrent
          // compilers, and what every compiler used before this was wired up.
          useMemoryCache,

      // Enable source maps for debugging
      // Server uses eval-source-map (fast + accurate) instead of full source-map
      devtool: config.env(
        'RSPACK_DEVTOOL',
        isDev
          ? isServer
            ? 'eval-source-map'
            : 'eval-cheap-module-source-map'
          : false,
      ),

      plugins: [new rspack.EnvironmentPlugin({ NODE_ENV: nodeEnv })],

      node: {
        __dirname: false,
        __filename: false,
        global: false,
      },
    },
    mergeOptions,
    {
      output: {
        clean: false,
      },
    },
  );
}

// =============================================================================
// WORKER CONFIG BUILDER
// =============================================================================

/**
 * Discover `*.worker.js` files recursively in a directory and return rspack
 * entry descriptors. Each entry gets `library: { type: 'commonjs' }` so the
 * output is a standalone CJS file for worker function isolation.
 *
 * @param {string} workersDir - Absolute path to the workers directory
 * @param {string} [prefix='workers'] - Output subdirectory prefix
 * @returns {Object} Rspack entry map (entryName → entry descriptor)
 */
function discoverWorkerEntries(workersDir, prefix = 'workers') {
  const entries = {};

  try {
    const files = fs.readdirSync(workersDir, {
      withFileTypes: true,
      recursive: true,
    });
    for (const file of files) {
      if (!file.isFile()) continue;
      const match = file.name.match(/^(.+\.worker)\.[cm]?[jt]s$/i);
      if (match) {
        // Dirent.parentPath exists in Node 21+, Dirent.path in Node 20+
        // For older versions, fall back to workersDir (flat scan)
        const fileDir = file.parentPath || file.path || workersDir;
        const filePath = path.join(fileDir, file.name);

        // Only compile workers that opt in to thread pool execution.
        // Workers without `WORKER_POOL = true` remain Tier 1 (direct import
        // in server.js, same-process execution).
        // Strip comments before checking to avoid false positives from
        // commented-out `// export const WORKER_POOL = true;` lines.
        const content = fs.readFileSync(filePath, 'utf8');
        const stripped = content
          .replace(/\/\/.*$/gm, '') // strip single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
        if (!/\bWORKER_POOL\s*=\s*true\b/.test(stripped)) continue;

        const relDir = path.relative(workersDir, fileDir);
        const entryName = relDir
          ? `${prefix}/${relDir}/${match[1]}`
          : `${prefix}/${match[1]}`;
        entries[entryName] = {
          import: filePath,
          library: { type: 'commonjs' },
        };
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }

  return entries;
}

/**
 * Create an rspack configuration that compiles `*.worker.js` files as
 * standalone CJS modules for isolated worker function execution.
 *
 * Reusable by both core apps (`app.config.js`) and extensions
 * (`extension.config.js`). Returns `null` if no workers are found.
 *
 * Always targets Node.js with proper `externals` regardless of the
 * compiler `name`, so workers are never accidentally bundled for the
 * browser or missing node_modules externalization.
 *
 * @param {Object} options
 * @param {string} options.workersDir - Absolute path to the workers source directory
 * @param {string} options.outputPath - Absolute path for the output directory
 * @param {string} [options.prefix='workers'] - Subdirectory prefix for output filenames
 * @param {string} [options.name='server'] - Rspack compiler name (must be unique per multi-compiler)
 * @param {string[]} [options.additionalModuleDirs=[]] - Extra node_modules directories (e.g. extension-local)
 * @param {import('@rspack/core').RspackPluginInstance[]} [options.plugins=[]] - Additional plugins
 * @returns {Object|null} Rspack config or null if no workers found
 */
function createWorkerConfig({
  workersDir,
  outputPath,
  prefix = 'workers',
  name = 'server',
  additionalModuleDirs = [],
  plugins = [],
}) {
  const entries = discoverWorkerEntries(workersDir, prefix);

  // Skip if no workers found
  if (Object.keys(entries).length === 0) return null;

  const cfg = createRspackConfig(name, {
    // Workers always run in Node — override target in case name !== 'server'
    target: 'node',
    entry: entries,
    additionalModuleDirs,
    output: {
      path: outputPath,
      filename: '[name].js',
    },
    plugins: [createEnvDefine(), ...plugins].filter(Boolean),
  });

  // Ensure additional module dirs are resolvable at compile time
  if (additionalModuleDirs.length > 0) {
    for (const dir of additionalModuleDirs) {
      cfg.resolve.modules.unshift(dir);
    }
  }

  return cfg;
}

/**
 * Get the HMR watch ignored paths.
 *
 * Returns an immutable array of Chokidar-compatible glob patterns that the
 * Rspack file watcher should skip. These paths are excluded because they:
 *
 * - **Dependencies:** `node_modules` — never compiled directly by Rspack.
 * - **Version control:** `.git` — metadata changes must not trigger rebuilds.
 * - **Runtime state:** `.xnapify` — SQLite DB, Node-RED flows, and other
 *   runtime artifacts that are constantly mutated during development.
 * - **Build caches:** `.cache`, `BUILD_DIR` — watching build output can
 *   create feedback loops; caches are consumed, not compiled.
 * - **Test artifacts:** `__tests__`, `*.test.*`, `*.spec.*` — test file
 *   changes should trigger Jest, not the bundler.
 * - **Benchmarks:** `__benchmarks__`, `*.benchmark.*` — performance tests
 *   are not part of the application module graph.
 *
 * @returns {readonly string[]} Frozen array of ignored glob patterns
 */
function getHmrWatchIgnored() {
  const buildDirGlob = config.BUILD_DIR.replace(/\\/g, '/');
  return Object.freeze([
    // Dependencies
    '**/node_modules/**',

    // Version control & runtime state
    '**/.git/**',
    '**/.xnapify/**',
    '**/.cache/**',

    // Test & benchmark files
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__benchmarks__/**',
    '**/*.benchmark.*',

    // Build output
    `${buildDirGlob}/**`,
  ]);
}

// =============================================================================
// EXPORTS
// =============================================================================

const frozenPkg = Object.freeze(pkg);

export {
  // Constants
  isDev,
  verbose,
  isProfile,
  frozenPkg as pkg,
  targetBrowsers,

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
  createRspackConfig,
  createWorkerConfig,
  getHmrWatchIgnored,
  MF_STRICT_SINGLETONS,
  MF_HOST_EAGER_DEPS,
};
