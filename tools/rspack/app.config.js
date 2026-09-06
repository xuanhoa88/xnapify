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
import merge from 'rspack-merge';

import config from '../config.js';
import { rspackConfigs } from '../factories/registry.factory.js';
import { isVerbose, logInfo, logWarn } from '../utils/logger.js';

import {
  createCacheGroups,
  createRspackConfig,
  createWorkerConfig,
  createCSSRule,
  createEnvDefine,
  createHostProvidedCSSPlugins,
  createProgressPlugin,
  createSharedDependencies,
  getHmrWatchIgnored,
  isDev,
  pkg,
  MF_HOST_EAGER_DEPS,
} from './base.config.js';
import PrecompressPlugin from './PrecompressPlugin.js';
import StatsManifestPlugin from './StatsManifestPlugin.js';

const require = createRequire(import.meta.url);
const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Webpack plugin that writes a minimal stats.json containing only the asset
 * filenames needed by the SSR template to emit <script>, <link rel="stylesheet">,
 * and <link rel="preload"> tags.
 *
 * Filters out hot-update chunks, source maps, and duplicate entries.
 * Includes both entry assets AND preloaded child chunks so that the SSR
 * template can emit <link rel="preload"> for async client bundles produced
 * by the Module Federation bootstrap wrapper.
 *
 * Output shape:
 *   { "scripts": ["main.abc123.js"], "stylesheets": ["main.abc123.css"] }
 *
 * @returns {import('@rspack/core').RspackPluginInstance}
 */
/**
 * Source files under `src/apps/**\/views/` that the router can match: route
 * modules, layout modules, and the `(routes)/(name)` form.
 */
const VIEW_FILE =
  /src[\\/]apps[\\/](.+?[\\/]views[\\/](?:.+?_(?:route|layout)|\(routes\)[\\/]\([^)]+\))\.[cm]?[jt]sx?)$/;

/**
 * Map every view source file to the script files the browser must have
 * loaded before that view can render.
 *
 * The views context is lazy, so each route lives in its own chunk and the
 * server has to name that chunk in the page or the browser only discovers it
 * after running the bootstrap bundle. The mapping is read off the live
 * compilation — `compilation.modules` still lists the original modules after
 * scope hoisting, and `chunkGraph.getModuleChunksIterable` answers which
 * chunks hold each one — because the equivalent stats query
 * (`chunkModules: true`) serialises every module of every chunk and takes an
 * order of magnitude longer on every rebuild.
 *
 * Entry and initial chunks are skipped: they already ship with the page.
 *
 * @param {object} compilation - The rspack compilation
 * @param {object} statsData - Chunk-level stats, used for sibling links
 * @returns {Object<string, string[]>} View path → chunk filenames
 */
function buildViewMap(compilation, statsData) {
  const views = {};
  if (!compilation || !compilation.chunkGraph) return views;

  // A chunk that belongs to a group with other chunks needs them too; the
  // sibling links only exist at the stats level.
  const chunksById = new Map();
  (statsData.chunks || []).forEach(chunk => {
    if (chunk.id !== undefined && chunk.id !== null) {
      chunksById.set(String(chunk.id), chunk);
    }
  });
  const siblingsOf = new Map();
  (statsData.chunks || []).forEach(chunk => {
    const files = (chunk.siblings || [])
      .map(id => chunksById.get(String(id)))
      .filter(sibling => sibling && !sibling.entry && !sibling.initial)
      .flatMap(sibling => sibling.files || [])
      .filter(name => name.endsWith('.js') && !/\.hot-update\./i.test(name));
    (chunk.files || []).forEach(name => siblingsOf.set(name, files));
  });

  for (const mod of compilation.modules) {
    const source =
      mod.resource ||
      (typeof mod.nameForCondition === 'function'
        ? mod.nameForCondition()
        : null);
    if (typeof source !== 'string') continue;

    const match = source.match(VIEW_FILE);
    if (!match) continue;

    const key = match[1].split('\\').join('/');
    const files = new Set(views[key] || []);
    for (const chunk of compilation.chunkGraph.getModuleChunksIterable(mod)) {
      // Entry and initial chunks already ship with the page; naming them
      // again only pads the manifest the SSR template renders. Mirrors the
      // `!sibling.entry && !sibling.initial` filter applied above —
      // `canBeInitial()` is true for entry chunks as well as initial ones.
      if (typeof chunk.canBeInitial === 'function' && chunk.canBeInitial()) {
        continue;
      }
      for (const name of chunk.files) {
        if (!name.endsWith('.js') || /\.hot-update\./i.test(name)) continue;
        files.add(name);
        (siblingsOf.get(name) || []).forEach(sibling => files.add(sibling));
      }
    }
    if (files.size > 0) views[key] = Array.from(files);
  }

  return views;
}

/**
 * The chunk holding the client's async bootstrap (`src/bootstrap/views.js`).
 *
 * Everything the router needs — the module lifecycle registry, every
 * module's `views/index.js`, and the lazy context maps — lives in this one
 * chunk, and `client.js` `import()`s it on every page. Left out of the page
 * it is discovered only after the entry bundle runs, so the route and locale
 * chunks the server carefully pre-emitted sit idle waiting for it. Rspack's
 * `webpackPreload` hint does not reach the entrypoint's stats children, so
 * the chunk is resolved the same way views are.
 *
 * @param {object} compilation - The rspack compilation
 * @returns {string[]} Chunk filenames, empty when it cannot be resolved
 */
function findBootstrapChunks(compilation) {
  if (!compilation || !compilation.chunkGraph) return [];

  const files = new Set();
  for (const mod of compilation.modules) {
    const source =
      mod.resource ||
      (typeof mod.nameForCondition === 'function'
        ? mod.nameForCondition()
        : null);
    if (typeof source !== 'string') continue;
    if (!/src[\\/]bootstrap[\\/]views\.[cm]?[jt]s$/.test(source)) continue;

    for (const chunk of compilation.chunkGraph.getModuleChunksIterable(mod)) {
      for (const name of chunk.files) {
        if (name.endsWith('.js') && !/\.hot-update\./i.test(name)) {
          files.add(name);
        }
      }
    }
  }
  return Array.from(files);
}

function createStatsWriterPlugin() {
  return new StatsManifestPlugin({
    filename: path.join(config.BUILD_DIR, 'stats.json'),
    incremental: false,
    ignoreErrors: false,
    statsOptions: {
      all: false,
      entrypoints: true,
      assets: true,
      chunkGroups: true,
      namedChunkGroups: true,
      // Needed to map each view file to the chunk it landed in. The views
      // context is lazy, so a route lives in its own chunk and the server
      // has to name that chunk to avoid a second round trip. Scope hoisting
      // buries view files inside concatenated modules, so nested modules
      // must be reported and the default listing caps lifted.
      // Chunk-level only. The view→chunk map is built from the live
      // compilation instead (see buildViewMap): asking `toJson` for it via
      // `chunkModules` serialises every module of every chunk and costs
      // ~475 ms on each rebuild, which in dev is paid before the browser is
      // told to refresh.
      chunks: true,
      // Sibling links, so a view's entry lists the whole chunk group rather
      // than just the file its own module landed in — a route that pulls in
      // a split group (a locale dictionary, a vendor split) needs those too
      // or the browser discovers them only after running the route chunk.
      chunkRelations: true,
    },
    transform: (statsData, _manifest, _compiler, compilation) => {
      const scripts = new Set();
      const stylesheets = new Set();

      const isHotUpdate = name => /\.hot-update\./i.test(name);
      const isSourceMap = name => name.endsWith('.map');
      const isScript = name => name.endsWith('.js');
      const isStylesheet = name => name.endsWith('.css');

      const addAsset = asset => {
        const name =
          typeof asset === 'object' && asset !== null && asset.name
            ? asset.name
            : asset;
        if (
          !name ||
          typeof name !== 'string' ||
          isHotUpdate(name) ||
          isSourceMap(name)
        )
          return;
        if (isScript(name)) scripts.add(name);
        if (isStylesheet(name)) stylesheets.add(name);
      };

      // 1. Ordered assets from the client entrypoint (preserves load order).
      const clientEntry =
        (statsData.entrypoints && statsData.entrypoints.client) || null;
      if (clientEntry) {
        (clientEntry.assets || []).forEach(addAsset);

        // Preloaded child chunks (e.g. async MF bootstrap wrapper).
        (
          (clientEntry.childAssets && clientEntry.childAssets.preload) ||
          []
        ).forEach(addAsset);
      } else {
        console.warn(
          '[StatsWriterPlugin] No "client" entrypoint found in stats — scripts will be empty.',
        );
      }

      // 2. CSS safety net: sweep all emitted assets for any CSS not already
      //    captured above (e.g. async-imported CSS chunks). This prevents FOUC
      //    when MiniCssExtractPlugin emits chunks outside the main entrypoint.
      (statsData.assets || []).forEach(asset => {
        const name =
          typeof asset === 'object' && asset !== null && asset.name
            ? asset.name
            : asset;
        if (
          name &&
          typeof name === 'string' &&
          isStylesheet(name) &&
          !isHotUpdate(name)
        ) {
          stylesheets.add(name);
        }
      });

      // 3. Map every view source file to the chunk that contains it, keyed
      //    by its path under src/apps/ so the router's own file paths line
      //    up. Built from the compilation, not from the stats JSON.
      const views = buildViewMap(compilation, statsData);

      // 4. Locale dictionary chunks, named by the `locale.<code>` cache
      //    group, so the server can ship the language it just rendered in
      //    rather than making the browser discover it.
      const locales = {};
      (statsData.chunks || []).forEach(chunk => {
        const name = (chunk.names || []).find(n => /^locale\./.test(n));
        if (!name) return;
        const files = (chunk.files || [])
          .filter(isScript)
          .filter(f => !isHotUpdate(f));
        if (files.length > 0) locales[name.slice('locale.'.length)] = files;
      });

      // The async bootstrap chunk every page needs, named in the document so
      // it downloads beside the entry bundle rather than after it.
      findBootstrapChunks(compilation).forEach(name => scripts.add(name));

      return {
        scripts: Array.from(scripts),
        stylesheets: Array.from(stylesheets),
        views,
        locales,
      };
    },
  });
}

// =============================================================================
// CLIENT CONFIG
// =============================================================================

/**
 * Configuration for the client-side bundle (client.js)
 * Targets web browsers with optimizations for production
 *
 * Uses an async bootstrap entry (src/bootstrap/client.js) to create
 * a Module Federation async boundary — shared modules like i18next
 * and react-i18next are fully initialized before the app code runs.
 */
const clientConfig = createRspackConfig('client', {
  entry: {
    client: [
      ...(isDev
        ? [path.join(currentDir, 'browserSync', 'client.config.js')]
        : []),
      path.join(config.APP_DIR, 'client.js'),
    ],
  },
  output: {
    path: path.join(config.BUILD_DIR, 'public'),
    filename: isDev
      ? 'assets/[name].js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].js',
    chunkFilename: isDev
      ? 'assets/[name].chunk.js'
      : 'assets-[fullhash:8]/[name].[chunkhash:8].chunk.js',
    hotUpdateMainFilename: isDev
      ? 'assets/[runtime].[fullhash].hot-update.json'
      : undefined,
    hotUpdateChunkFilename: isDev
      ? 'assets/[id].[fullhash].hot-update.js'
      : undefined,
  },
  optimization: {
    splitChunks: {
      cacheGroups: createCacheGroups('all'),
    },
  },
  module: {
    rules: [
      createCSSRule({
        extractLoader: rspack.CssExtractRspackPlugin.loader,
      }),
    ],
  },
  plugins: [
    new rspack.ProvidePlugin({
      process: require.resolve('process/browser'),
    }),
    createEnvDefine(),
    new rspack.container.ModuleFederationPlugin({
      name: 'host',
      // Only the packages the entry needs synchronously are eager; the rest
      // are consumed from the share scope by the async chunk that first
      // imports them (views, editor, forms), keeping them off the first load.
      shared: createSharedDependencies(pkg.dependencies || {}, {
        eager: false,
        eagerDeps: MF_HOST_EAGER_DEPS,
        singleton: true,
        strictVersion: false,
      }),
    }),
    new rspack.CssExtractRspackPlugin({
      filename: isDev
        ? 'assets/[name].css'
        : 'assets-[fullhash:8]/[name].[contenthash:8].css',
      chunkFilename: isDev
        ? 'assets/[id].css'
        : 'assets-[fullhash:8]/[id].[contenthash:8].css',
      ignoreOrder: isDev,
    }),
    createStatsWriterPlugin(),
    // Emit .br/.gz siblings so the server never compresses immutable assets
    // per request (see shared/api/engines/http/precompressed.js).
    !isDev && new PrecompressPlugin(),
    createProgressPlugin(),
  ].filter(Boolean),
});

// =============================================================================
// SERVER CONFIG
// =============================================================================

/**
 * Configuration for the server-side bundle (server.js)
 * Targets Node.js environment with CommonJS output
 */
const serverConfig = createRspackConfig('server', {
  entry: {
    server: [path.join(config.APP_DIR, 'server.js')],
  },
  output: {
    path: config.BUILD_DIR,
    filename: '[name].js',
  },
  module: {
    rules: [createCSSRule({ exportOnlyLocals: true })],
  },
  plugins: [
    createEnvDefine(),
    ...createHostProvidedCSSPlugins(),
    ...(isDev
      ? [
          new rspack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: false,
          }),
        ]
      : []),
  ],
});

// =============================================================================
// WORKER CONFIGS (Core Apps)
// =============================================================================

/**
 * Discover and compile worker files from all core app modules.
 * Each app gets a unique rspack compiler name (`workers-<appName>`) so the
 * dev server can watch them independently.
 *
 * Scans `src/apps/<appName>/api/workers/` directories.
 * Output: `BUILD_DIR/workers/<appName>/<name>.worker.js`
 */
const workerConfig = (() => {
  const configs = [];

  try {
    const appsDir = path.join(config.APP_DIR, 'apps');
    const appDirs = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const appDir of appDirs) {
      // Skip files, hidden dirs, and route-group dirs like (default)
      if (
        !appDir.isDirectory() ||
        appDir.name.startsWith('.') ||
        appDir.name.startsWith('(')
      )
        continue;

      configs.push(
        createWorkerConfig({
          workersDir: path.join(appsDir, appDir.name, 'api', 'workers'),
          outputPath: config.BUILD_DIR,
          prefix: `workers/${appDir.name}`,
          name: `workers-${appDir.name}`,
        }),
      );
    }
  } catch (err) {
    // Missing apps directory is expected — anything else should be surfaced
    if (err.code !== 'ENOENT') {
      logWarn(`⚠️ Failed to scan app workers: ${err.message}`);
    }
  }

  const result = configs.filter(Boolean);

  if (isVerbose() && result.length > 0) {
    logInfo(
      `🔧 Discovered ${result.length} worker compiler(s): ${result.map(c => c.name).join(', ')}`,
    );
  }

  return result;
})();

// =============================================================================
// APPLY REGISTRY rspack CONFIGURATIONS (CORE APPS)
// =============================================================================

let finalClientConfig = clientConfig;
let finalServerConfig = serverConfig;

// Filter for customizers belonging specifically to core apps
const coreAppRspackConfigs = (
  Array.isArray(rspackConfigs) ? rspackConfigs : []
).filter(cfg => cfg.moduleDir.startsWith(path.join(config.APP_DIR, 'apps')));

for (const customRspack of coreAppRspackConfigs) {
  try {
    const appCustomizer =
      require(customRspack.path).default || require(customRspack.path);
    if (typeof appCustomizer === 'function') {
      finalClientConfig =
        appCustomizer(finalClientConfig, merge) || finalClientConfig;
      finalServerConfig =
        appCustomizer(finalServerConfig, merge) || finalServerConfig;
    } else if (typeof appCustomizer === 'object') {
      finalClientConfig = merge(finalClientConfig, appCustomizer);
      finalServerConfig = merge(finalServerConfig, appCustomizer);
    }
  } catch (err) {
    logWarn(
      `Skipping invalid rspack config in core app ${path.basename(customRspack.moduleDir)}:`,
      err,
    );
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  finalClientConfig as clientConfig,
  finalServerConfig as serverConfig,
  workerConfig,
  getHmrWatchIgnored,
  // Exported for tests; the build reaches it through the stats plugin.
  buildViewMap,
};
