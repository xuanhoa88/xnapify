/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const pick = require('lodash/pick');
const snakeCase = require('lodash/snakeCase');
const semver = require('semver');
const webpack = require('webpack');

const config = require('../config');
const { computeChecksum } = require('../utils/checksum');
const { logInfo, logError, formatDuration } = require('../utils/logger');
const { toContainerName } = require('../utils/extension');
const { isDev } = require('../webpack/base.config');
const createExtensionConfig = require('../webpack/extension.config');

// Promisify execFile
const execFileAsync = util.promisify(execFile);

// Configuration
const EXTENSION_PATH = config.env('RSK_EXTENSION_LOCAL_PATH', 'extensions');
const EXTENSIONS_DIR = path.resolve(config.APP_DIR, EXTENSION_PATH);
const EXTENSIONS_BUILD_DIR = path.resolve(config.BUILD_DIR, EXTENSION_PATH);

/**
 * Discover extensions from the extensions directory
 * @returns {Array} Array of extension objects with name, path, and parsed manifest
 */
function discoverExtensions() {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(EXTENSIONS_DIR)
    .map(name => {
      const extensionPath = path.join(EXTENSIONS_DIR, name);
      const manifestPath = path.join(extensionPath, 'package.json');

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const hasMain =
          manifest.main && fs.existsSync(path.join(extensionPath, manifest.main));
        const hasBrowser =
          manifest.browser &&
          fs.existsSync(path.join(extensionPath, manifest.browser));

        if (hasMain || hasBrowser) {
          return {
            manifest,
            name: snakeCase(manifest.name || name),
            version: semver.clean(manifest.version),
            path: extensionPath,
          };
        }
      } catch {
        // Invalid or missing manifest
      }
      return null;
    })
    .filter(Boolean);
}
/**
 * Generate package.json for each built extension
 * @param {Array} extensions - Array of extension objects
 */
async function generateManifests(extensions) {
  for (const {
    name,
    version,
    manifest: initialManifest,
    path: extensionPath,
  } of extensions) {
    const outputDir = path.join(EXTENSIONS_BUILD_DIR, name);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Re-read package.json from source on every build so metadata changes
    // (e.g. rsk.subscribe) are picked up during watch-mode rebuilds.
    let manifest = initialManifest;
    const sourceManifest = path.join(extensionPath, 'package.json');
    if (fs.existsSync(sourceManifest)) {
      try {
        manifest = JSON.parse(fs.readFileSync(sourceManifest, 'utf8'));
      } catch {
        // Fall back to the initially discovered manifest
      }
    }

    // Compute checksum of all built files
    const checksum = await computeChecksum(outputDir);

    const outputManifest = {
      ...pick(manifest, [
        'version',
        'description',
        'dependencies',
        'peerDependencies',
        'keywords',
        'author',
        'license',
        'homepage',
        'repository',
        'rsk',
      ]),
      ...(manifest.main && {
        main: './api.js',
      }),
      ...(manifest.browser && {
        browser: './browser.js',
      }),
    };

    // Set name to snake_case
    outputManifest.name = name;
    outputManifest.version = version;

    // Set rsk metadata with original name, containerName, checksum, and
    // build timestamp so dev-mode HMR can detect code changes even when the
    // package.json version stays the same.
    outputManifest.rsk = {
      ...outputManifest.rsk,
      name: manifest.name,
      containerName: toContainerName(name),
      checksum,
      buildTimestamp: Date.now(),
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
 * Bundle extensions using Webpack
 * @param {Object} options - Build options
 * @param {boolean} options.watch - Whether to watch for changes
 * @returns {Promise<void>}
 */
async function buildExtensions(options = {}) {
  const isWatch =
    config.env('NODE_ENV') === 'development' &&
    (options.watch || process.argv.includes('--watch'));
  const extensions = discoverExtensions();

  if (extensions.length === 0) {
    logInfo('📦 No extensions found to build');

    // In watch mode, stay alive and use webpack's native watch
    if (isWatch) {
      logInfo('👀 Watching for new extensions...');

      // Ensure extensions directory exists
      if (!fs.existsSync(EXTENSIONS_DIR)) {
        fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
      }

      // Create a placeholder entry file for webpack to watch
      const placeholderFile = path.join(EXTENSIONS_DIR, '.placeholder.js');
      if (!fs.existsSync(placeholderFile)) {
        fs.writeFileSync(placeholderFile, '// Placeholder for webpack watch\n');
      }

      // Create minimal webpack config to watch the extensions directory
      const watchConfig = {
        mode: 'development',
        entry: placeholderFile,
        output: {
          path: EXTENSIONS_BUILD_DIR,
          filename: '.placeholder.js',
        },
        plugins: [
          {
            apply: compiler => {
              // Add extensions directory to watch dependencies
              compiler.hooks.afterCompile.tap(
                'WatchExtensionsDir',
                compilation => {
                  compilation.contextDependencies.add(EXTENSIONS_DIR);
                },
              );

              // Check for new extensions after each compilation
              compiler.hooks.done.tap('CheckForExtensions', async () => {
                const newExtensions = discoverExtensions();
                if (newExtensions.length > 0) {
                  logInfo(
                    `🔍 New extension(s) detected: ${newExtensions.map(p => p.name).join(', ')}`,
                  );
                  compiler.close(() => {
                    // Restart with real extensions
                    buildExtensions(options);
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
      // For dev server, we probably want it to resolve immediately if no extensions so server can start.
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
        watcher.watch(
          {
            ignored: [
              '**/node_modules/**',
              '**/*.test.js',
              '**/*.spec.js',
              '**/__tests__/**',
            ],
            aggregateTimeout: 300,
          },
          () => {
            // Resolve on first build (even if placeholder)
            resolve();
          },
        );
      });
    }
    return;
  }

  logInfo(`🚀 Building ${extensions.length} extension(s)...`);
  const start = Date.now();

  // Ensure all extensions have their dependencies installed before building
  if (isDev) {
    logInfo(`📦 Installing dependencies for ${extensions.length} extension(s)...`);
    for (const ext of extensions) {
      if (fs.existsSync(path.join(ext.path, 'package.json'))) {
        try {
          await execFileAsync(
            'npm',
            [
              'install',
              '--no-audit',
              '--no-update-notifier',
              '--no-fund',
              '--engine-strict',
              '--no-package-lock',
            ],
            { cwd: ext.path },
          );
          if (config.env('NODE_ENV') === 'development') {
            console.log(
              `[ExtensionBuild] npm install completed for ${ext.name}`,
            );
          }
        } catch (npmErr) {
          logError(`Failed to install dependencies for extension ${ext.name}`);
          console.error(npmErr);
        }
      }
    }
  }

  const compiler = webpack(
    createExtensionConfig({
      extensions,
      buildPath: EXTENSIONS_BUILD_DIR,
    }),
  );

  return new Promise((resolve, reject) => {
    let initialBuildComplete = false;

    const onBuild = async (err, stats) => {
      const error = handleBuildResult(err, stats, isWatch);

      if (error && !isWatch) {
        reject(error);
        return;
      }

      await generateManifests(extensions);

      const duration = Date.now() - start;
      logInfo(`✅ Extension build completed in ${formatDuration(duration)}`);

      // Notify the server process to refresh extensions on successful rebuild
      if (!error && isWatch) {
        const extensionNames = extensions.map(p => p.name);
        const msg = { type: 'extensions-refreshed', extensions: extensionNames };
        if (typeof process.send === 'function') {
          process.send(msg);
        } else {
          process.emit('message', msg);
        }
        logInfo(
          `🔌 Sent extensions-refreshed to server: ${extensionNames.join(', ')}`,
        );
      }

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
      logInfo('👀 Watching for extension changes...');
      compiler.watch(
        {
          ignored: [
            '**/node_modules/**',
            '**/*.test.js',
            '**/*.spec.js',
            '**/__tests__/**',
          ],
          aggregateTimeout: 300,
        },
        onBuild,
      );
    } else {
      compiler.run(onBuild);
    }
  });
}

// CLI entry point
if (require.main === module) {
  buildExtensions().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = buildExtensions;
