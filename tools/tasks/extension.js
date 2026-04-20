/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const pick = require('lodash/pick');
const semver = require('semver');
const webpack = require('webpack');

const config = require('../config');
const { computeChecksum, generateExtensionId } = require('../utils/extension');
const { copyDir, pathExists } = require('../utils/fs');
const { logInfo, logError, formatDuration } = require('../utils/logger');
const {
  createExtensionConfig,
  getHmrWatchIgnored,
} = require('../webpack/extension.config');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_PATH = config.env('XNAPIFY_EXTENSION_LOCAL_PATH', 'extensions');
const EXTENSIONS_DIR = path.resolve(config.APP_DIR, EXTENSION_PATH);
const EXTENSIONS_BUILD_DIR = path.resolve(config.BUILD_DIR, EXTENSION_PATH);

/** Fields preserved in the built package.json (allowlist for safety). */
const MANIFEST_FIELDS = [
  'name',
  'version',
  'description',
  'keywords',
  'author',
  'license',
  'homepage',
  'repository',
  'dependencies',
  'peerDependencies',
  'icon',
  'screenshots',
  'slots',
  'autoload',
];

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover valid extensions from the local extensions directory.
 * An extension must have a package.json with `name` and at least one
 * entry point (`main` or `browser`) that exists on disk.
 *
 * @returns {Array<{manifest: Object, name: string, dirName: string, version: string, path: string}>}
 */
function discoverExtensions() {
  if (!fs.existsSync(EXTENSIONS_DIR)) return [];

  return fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const extensionPath = path.join(EXTENSIONS_DIR, dirent.name);
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8'),
        );

        if (!manifest.name) {
          logError(`Extension at ${dirent.name} missing "name" — skipped`);
          return null;
        }

        const hasMain =
          manifest.main &&
          fs.existsSync(path.join(extensionPath, manifest.main));
        const hasBrowser =
          manifest.browser &&
          fs.existsSync(path.join(extensionPath, manifest.browser));

        if (!hasMain && !hasBrowser) return null;

        return {
          manifest,
          name: manifest.name,
          dirName: manifest.name,
          id: generateExtensionId(manifest.name),
          version: semver.clean(manifest.version) || '0.0.0',
          path: extensionPath,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Manifest Generation
// ---------------------------------------------------------------------------

/**
 * (Re-)generate the built package.json for each extension.
 * Re-reads source manifest on every call so watch-mode picks up metadata changes.
 *
 * Reads `stats.json` (written by BuildManifestPlugin) to resolve
 * content-hashed filenames for entry points.
 *
 * The `id` field is generated at build time via `generateExtensionId(name)`
 * and written into the output manifest. Runtime managers read it directly.
 */
async function generateManifests(extensions) {
  for (const { name, dirName, version, path: extensionPath } of extensions) {
    const outputDir = path.join(EXTENSIONS_BUILD_DIR, dirName);
    fs.mkdirSync(outputDir, { recursive: true });

    // Re-read source manifest to pick up metadata changes during watch-mode
    let manifest;
    try {
      manifest = JSON.parse(
        fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8'),
      );
    } catch {
      logError(`Failed to read manifest for ${name} — skipped`);
      continue;
    }

    // Read stats.json for content-hashed filenames
    let buildManifest = {};
    try {
      buildManifest = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'stats.json'), 'utf8'),
      );
    } catch {
      logInfo(
        `No stats.json for ${name} — entry points will use logical names`,
      );
    }

    let checksum;
    try {
      checksum = await computeChecksum(outputDir);
    } catch (checksumErr) {
      // Gracefully degrade — use a timestamp-based fallback so the build
      // continues even if hashing fails (e.g. broken symlinks).
      logError(
        `⚠️  Checksum failed for ${name}: ${checksumErr.message} — using fallback`,
      );
      checksum = `fallback-${Date.now()}`;
    }

    const outputManifest = {
      ...pick(manifest, MANIFEST_FIELDS),
      // Canonical identity
      name,
      version,
      // Entry points (resolved from stats.json hashed filenames)
      ...(manifest.main && {
        main: `./${buildManifest['api.js'] || 'api.js'}`,
      }),
      ...(manifest.browser && {
        browser: `./${buildManifest['browser.js'] || 'browser.js'}`,
      }),
      // Build metadata
      id: generateExtensionId(name),
      integrity: checksum,
      builtAt: Date.now(),
    };

    fs.writeFileSync(
      path.join(outputDir, 'package.json'),
      JSON.stringify(outputManifest, null, 2),
    );
  }
}

// ---------------------------------------------------------------------------
// Static Assets
// ---------------------------------------------------------------------------

async function copyStaticAssets(extensions) {
  for (const { name, dirName, path: extensionPath } of extensions) {
    const source = path.join(extensionPath, 'assets');
    const target = path.join(EXTENSIONS_BUILD_DIR, dirName, 'assets');

    if (await pathExists(source)) {
      await copyDir(source, target);
      logInfo(`📁 Copied static assets for ${name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Extension Node Modules
// ---------------------------------------------------------------------------

/**
 * Symlink each extension's source `node_modules` into the build output.
 *
 * Webpack's `nodeExternals` marks extension-local dependencies as externals
 * (e.g. `passport-google-oauth20`). At runtime the built bundle `require()`s
 * them, but Node resolves from the *output* directory — which has no
 * `node_modules`. A symlink bridges the gap without duplicating files.
 */
async function linkExtensionNodeModules(extensions) {
  for (const { name, dirName, path: extensionPath } of extensions) {
    const source = path.join(extensionPath, 'node_modules');
    const target = path.join(EXTENSIONS_BUILD_DIR, dirName, 'node_modules');

    if (!(await pathExists(source))) continue;

    // Remove stale link or directory before creating a fresh symlink
    try {
      const stat = await fs.promises.lstat(target);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        await fs.promises.rm(target, { recursive: true, force: true });
      }
    } catch {
      // target doesn't exist — nothing to remove
    }

    await fs.promises.symlink(source, target, 'junction');
    logInfo(`🔗 Linked node_modules for ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Webpack Helpers
// ---------------------------------------------------------------------------

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

/** Notify the dev server that extension bundles have been rebuilt. */
function notifyServer(extensions) {
  const names = extensions.map(p => p.name);
  const msg = { type: 'extensions-refreshed', extensions: names };

  if (typeof process.send === 'function') {
    process.send(msg);
  } else {
    process.emit('message', msg);
  }
  logInfo(`🔌 Sent extensions-refreshed: ${names.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Watch-Mode (empty extensions directory)
// ---------------------------------------------------------------------------

/**
 * When no extensions exist yet, start a lightweight watcher that detects
 * when the first extension appears, then restarts with a real build.
 */
function watchForNewExtensions(options) {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }

  const placeholderFile = path.join(EXTENSIONS_DIR, '.placeholder.js');
  if (!fs.existsSync(placeholderFile)) {
    fs.writeFileSync(placeholderFile, '// Placeholder for webpack watch\n');
  }

  const watchConfig = {
    mode: 'development',
    entry: placeholderFile,
    output: { path: EXTENSIONS_BUILD_DIR, filename: '.placeholder.js' },
    plugins: [
      {
        apply: compiler => {
          compiler.hooks.afterCompile.tap('WatchExtensionsDir', compilation => {
            compilation.contextDependencies.add(EXTENSIONS_DIR);
          });
          compiler.hooks.done.tap('CheckForExtensions', () => {
            if (discoverExtensions().length > 0) {
              logInfo('🔍 New extension(s) detected — restarting build');
              compiler.close(() => buildExtensions(options));
            }
          });
        },
      },
    ],
  };

  const watcher = webpack(watchConfig);
  return new Promise(resolve => {
    watcher.watch(
      { ignored: getHmrWatchIgnored(), aggregateTimeout: 300 },
      () => resolve(),
    );
  });
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

async function buildExtensions(options = {}) {
  const isWatch =
    config.env('NODE_ENV') === 'development' &&
    (options.watch || process.argv.includes('--watch'));

  const extensions = discoverExtensions();

  if (extensions.length === 0) {
    logInfo('📦 No extensions found to build');
    if (isWatch) {
      logInfo('👀 Watching for new extensions...');
      return watchForNewExtensions(options);
    }
    return;
  }

  logInfo(`🔨 Compiling ${extensions.length} extension(s)...`);
  const start = Date.now();

  // Auto-cleanup: remove stale build directories that no longer match
  // any current extension (e.g. after ID scheme migration).
  // Handles both flat (my-ext/) and scoped (@org/name/) layouts.
  try {
    if (fs.existsSync(EXTENSIONS_BUILD_DIR)) {
      const validDirNames = new Set(extensions.map(e => e.dirName));
      const existing = fs.readdirSync(EXTENSIONS_BUILD_DIR, {
        withFileTypes: true,
      });
      for (const entry of existing) {
        if (!entry.isDirectory()) continue;

        if (entry.name.startsWith('@')) {
          // Scoped directory: check each child (@org/name)
          const scopeDir = path.join(EXTENSIONS_BUILD_DIR, entry.name);
          const scopeChildren = fs.readdirSync(scopeDir, {
            withFileTypes: true,
          });
          for (const child of scopeChildren) {
            if (!child.isDirectory()) continue;
            const scopedName = `${entry.name}/${child.name}`;
            if (!validDirNames.has(scopedName)) {
              const stale = path.join(scopeDir, child.name);
              fs.rmSync(stale, { recursive: true, force: true });
              logInfo(`🧹 Removed stale build directory: ${scopedName}`);
            }
          }
          // Remove empty scope directory
          const remaining = fs.readdirSync(scopeDir);
          if (remaining.length === 0) {
            fs.rmSync(scopeDir, { recursive: true, force: true });
          }
        } else if (!validDirNames.has(entry.name)) {
          const stale = path.join(EXTENSIONS_BUILD_DIR, entry.name);
          fs.rmSync(stale, { recursive: true, force: true });
          logInfo(`🧹 Removed stale build directory: ${entry.name}`);
        }
      }
    }
  } catch (cleanupErr) {
    logError(`Failed to clean stale build directories: ${cleanupErr.message}`);
  }

  const compiler = webpack(
    createExtensionConfig(extensions, EXTENSIONS_BUILD_DIR),
  );

  return new Promise((resolve, reject) => {
    let initialBuildComplete = false;

    const onBuild = async (err, stats) => {
      const error = handleBuildResult(err, stats, isWatch);

      if (error && !isWatch) {
        reject(error);
        return;
      }

      // Link node_modules and copy assets first so the output directory
      // is complete before generateManifests checksums it.
      await Promise.all([
        copyStaticAssets(extensions),
        linkExtensionNodeModules(extensions),
      ]);
      await generateManifests(extensions);

      logInfo(
        `✅ Extension build completed in ${formatDuration(Date.now() - start)}`,
      );

      if (!error && isWatch) {
        notifyServer(extensions);
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
        { ignored: getHmrWatchIgnored(), aggregateTimeout: 300 },
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
