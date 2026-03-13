'use strict';

/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * Webpack plugin that creates an async boundary for Module Federation.
 *
 * When Module Federation shares dependencies with `eager: true`, the
 * share scope must be initialised before any shared module is consumed.
 * This plugin auto-detects entry modules and replaces their source with
 * a dynamic import of the original, giving the runtime enough time to
 * initialise shared modules before application code executes.
 *
 * IMPORTANT: This plugin must be listed BEFORE ModuleFederationPlugin in
 * your webpack config. ModuleFederationPlugin registers the shared scope
 * during compilation setup; if this plugin runs after, the async boundary
 * will not be in place when the share scope initialises.
 *
 * @example
 * plugins: [
 *   new AsyncModuleFederationPlugin(),   // ← must come first
 *   new webpack.container.ModuleFederationPlugin({ ... }),
 * ]
 */

const path = require('path');

const config = require('../config');

// Plugin name
const PLUGIN_NAME = 'AsyncModuleFederationPlugin';

// Resolved once at module load time so the alreadyApplied check is an exact
// path comparison rather than a fragile substring match. loader-runner loads
// loaders via Node's require(), so this must be a real path on disk.
const ASYNC_ENTRY_LOADER = require.resolve('./asyncEntryLoader');

class AsyncModuleFederationPlugin {
  apply(compiler) {
    // Webpack 5 exposes `compiler.webpack`; Webpack 4 does not.
    if (!compiler.webpack) {
      throw new Error(
        `[${PLUGIN_NAME}] Webpack 5 is required — compiler.webpack is not defined.`,
      );
    }

    const entryPaths = new Set();
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    // ─── Collect entry paths ───────────────────────────────────────────────
    //
    // `entryOption` fires synchronously after webpack processes the `entry`
    // config value. It only covers *static* entries (string / array / object).
    // Dynamic entries (entry as a function) are resolved at build time and
    // cannot be intercepted here — we warn loudly rather than fail silently.

    compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
      if (typeof entry === 'function') {
        logger.warn(
          'Dynamic entry functions are not supported. ' +
            'The async boundary will NOT be applied. ' +
            'Convert your entry to a static string, array, or object, ' +
            'or wrap the async bootstrap manually (see README).',
        );
        return;
      }

      // Only entries under the project source root are wrapped. Tool entries
      // (BrowserSync, HMR client, etc.) are skipped because they do not
      // consume Module Federation shared modules.
      const sourceRoot = path.resolve(config.APP_DIR).replace(/\\/g, '/');

      /**
       * Recursively collect file paths from any valid webpack entry shape:
       *   string | string[] | EntryDescription | EntryObject
       *
       * @param {unknown} value
       */
      const collect = value => {
        if (typeof value === 'string') {
          const resolved = path
            .resolve(value.split('?')[0])
            .replace(/\\/g, '/');
          if (resolved.startsWith(sourceRoot + '/')) {
            entryPaths.add(resolved);
          }
        } else if (Array.isArray(value)) {
          value.forEach(collect);
        } else if (value !== null && typeof value === 'object') {
          // EntryDescription has `import`; EntryObject has named keys.
          collect(value.import != null ? value.import : Object.values(value));
        }
      };

      collect(entry);

      if (entryPaths.size === 0) {
        logger.warn(
          `No entry points detected under source root: ${sourceRoot}. ` +
            'The async boundary will not be applied.',
        );
      } else {
        logger.log(
          `Async boundary will be applied to ${entryPaths.size} entry point(s):`,
        );
        entryPaths.forEach(p => logger.log(`  • ${p}`));
      }
    });

    // ─── Inject loader into matching entry modules ─────────────────────────
    //
    // Loaders run right-to-left, so we unshift (prepend) so that the async
    // boundary loader executes *last* — after Babel/TS have transformed the
    // source — and wraps the compiled output in a dynamic import.

    compiler.hooks.compilation.tap(PLUGIN_NAME, compilation => {
      const { NormalModule } = compiler.webpack;

      NormalModule.getCompilationHooks(compilation).loader.tap(
        PLUGIN_NAME,
        (_loaderContext, mod) => {
          if (entryPaths.size === 0) return;

          const resource = (mod.resource || '')
            .replace(/\\/g, '/')
            .split('?')[0];
          if (!entryPaths.has(resource)) return;

          // Skip the re-imported module that the loader itself creates.
          if (
            (mod.request && mod.request.includes('?async-boundary')) ||
            (mod.resource && mod.resource.includes('?async-boundary'))
          )
            return;

          // Skip if already applied (e.g. during HMR rebuilds).
          if (mod.loaders.some(l => l.loader === ASYNC_ENTRY_LOADER)) return;

          mod.loaders.unshift({ loader: ASYNC_ENTRY_LOADER });
          logger.log(`Applied async boundary to: ${resource}`);
        },
      );
    });
  }
}

module.exports = AsyncModuleFederationPlugin;
