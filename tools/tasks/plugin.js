/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { logInfo, logError, formatDuration } = require('../utils/logger');
const createPluginConfig = require('../webpack/plugin.config');

// Configuration
const PLUGIN_PATH = process.env.RSK_PLUGIN_PATH || 'plugins';
const PLUGINS_DIR = path.resolve(config.APP_DIR, PLUGIN_PATH);
const PLUGINS_BUILD_DIR = path.resolve(config.BUILD_DIR, PLUGIN_PATH);

/**
 * Discover plugins from the plugins directory
 * @returns {Array} Array of plugin objects with name, path, and parsed manifest
 */
function discoverPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(PLUGINS_DIR)
    .map(name => {
      const pluginPath = path.join(PLUGINS_DIR, name);
      const manifestPath = path.join(pluginPath, 'package.json');

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const hasMain =
          manifest.main && fs.existsSync(path.join(pluginPath, manifest.main));
        const hasBrowser =
          manifest.browser &&
          fs.existsSync(path.join(pluginPath, manifest.browser));

        if (hasMain || hasBrowser) {
          return { name, path: pluginPath, manifest };
        }
      } catch {
        // Invalid or missing manifest
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Generate package.json for each built plugin
 * @param {Array} plugins - Array of plugin objects
 */
function generateManifests(plugins) {
  for (const { name, manifest } of plugins) {
    const outputDir = path.join(PLUGINS_BUILD_DIR, name);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputManifest = {
      ...manifest,
      ...(manifest.main && {
        main: './api.js',
      }),
      ...(manifest.browser && {
        browser: './browser.js',
      }),
    };

    fs.writeFileSync(
      path.join(outputDir, 'package.json'),
      JSON.stringify(outputManifest, null, 2),
    );
  }
}

/**
 * Handle webpack build result
 * @param {Error} err - Webpack error
 * @param {Object} stats - Webpack stats
 * @param {boolean} isWatch - Whether in watch mode
 * @returns {Error|null} Error if compilation failed
 */
function handleBuildResult(err, stats, isWatch) {
  if (err) {
    logError('Webpack configuration error');
    console.error(err.stack || err);
    if (err.details) console.error(err.details);
    return err;
  }

  const info = stats.toJson();

  if (stats.hasErrors()) {
    logError('Webpack compilation errors');
    info.errors.forEach(e => console.error(e));
    return new Error('Webpack compilation errors');
  }

  if (stats.hasWarnings() && !isWatch) {
    console.warn('Webpack warnings:');
    info.warnings.forEach(w => console.warn(w));
  }

  return null;
}

/**
 * Bundle plugins using Webpack
 * @param {Object} options - Build options
 * @param {boolean} options.watch - Whether to watch for changes
 * @returns {Promise<void>}
 */
async function buildPlugins(options = {}) {
  const isWatch =
    process.env.NODE_ENV === 'development' &&
    (options.watch || process.argv.includes('--watch'));
  const plugins = discoverPlugins();

  if (plugins.length === 0) {
    logInfo('📦 No plugins found to build');

    // In watch mode, stay alive and use webpack's native watch
    if (isWatch) {
      logInfo('👀 Watching for new plugins...');

      // Ensure plugins directory exists
      if (!fs.existsSync(PLUGINS_DIR)) {
        fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      }

      // Create a placeholder entry file for webpack to watch
      const placeholderFile = path.join(PLUGINS_DIR, '.placeholder.js');
      if (!fs.existsSync(placeholderFile)) {
        fs.writeFileSync(placeholderFile, '// Placeholder for webpack watch\n');
      }

      // Create minimal webpack config to watch the plugins directory
      const watchConfig = {
        mode: 'development',
        entry: placeholderFile,
        output: {
          path: PLUGINS_BUILD_DIR,
          filename: '.placeholder.js',
        },
        plugins: [
          {
            apply: compiler => {
              // Add plugins directory to watch dependencies
              compiler.hooks.afterCompile.tap(
                'WatchPluginsDir',
                compilation => {
                  compilation.contextDependencies.add(PLUGINS_DIR);
                },
              );

              // Check for new plugins after each compilation
              compiler.hooks.done.tap('CheckForPlugins', async () => {
                const newPlugins = discoverPlugins();
                if (newPlugins.length > 0) {
                  logInfo(
                    `🔍 New plugin(s) detected: ${newPlugins.map(p => p.name).join(', ')}`,
                  );
                  compiler.close(() => {
                    // Restart with real plugins
                    buildPlugins(options);
                  });
                }
              });
            },
          },
        ],
      };

      const watcher = webpack(watchConfig);
      // specific return for empty watch case?
      // Current logic strictly returned a promise that never resolves (watcher.watch)
      // For dev server, we probably want it to resolve immediately if no plugins so server can start.
      // But if we return, the process might exit if not held open?
      // tools/run.js waits for the promise.
      // If we resolve, run.js finishes this task.
      // If called from dev.js, we want to proceed.
      // So resolving is good. The watcher keeps the process alive?
      // No, watcher.watch returns a Watching object.
      // If we don't return a pending promise, the task function returns.
      // If run via tools/run.js, it finishes.
      // If run via dev.js, it continues to next step.

      return new Promise(resolve => {
        watcher.watch({ aggregateTimeout: 300 }, () => {
          // Resolve on first build (even if placeholder)
          resolve();
        });
      });
    }
    return;
  }

  logInfo(`🚀 Building ${plugins.length} plugin(s)...`);
  const start = Date.now();

  const compiler = webpack(
    createPluginConfig({
      plugins,
      buildPath: PLUGINS_BUILD_DIR,
    }),
  );

  return new Promise((resolve, reject) => {
    let initialBuildComplete = false;

    const onBuild = (err, stats) => {
      const error = handleBuildResult(err, stats, isWatch);

      if (error && !isWatch) {
        reject(error);
        return;
      }

      generateManifests(plugins);

      const duration = Date.now() - start;
      logInfo(`✅ Plugin build completed in ${formatDuration(duration)}`);

      if (!isWatch) {
        compiler.close(closeErr => {
          if (closeErr) console.error('Failed to close compiler:', closeErr);
          resolve();
        });
      } else if (!initialBuildComplete) {
        initialBuildComplete = true;
        resolve();
      }
    };

    if (isWatch) {
      logInfo('👀 Watching for plugin changes...');
      compiler.watch({ aggregateTimeout: 300 }, onBuild);
    } else {
      compiler.run(onBuild);
    }
  });
}

// CLI entry point
if (require.main === module) {
  buildPlugins().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = buildPlugins;
